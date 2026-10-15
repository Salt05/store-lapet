import xmlrpc from 'xmlrpc';
import https from 'https';
import http from 'http';

type OdooConfig = {
  url: string;
  db: string;
  user: string;
  apiKey: string;
};

/**
 * Custom Error Class định danh loại lỗi cho Frontend/API Service xử lý UX
 */
export class OdooGatewayError extends Error {
  public code: 'TIMEOUT' | 'AUTH_FAILED' | 'GATEWAY_ERROR';

  constructor(code: 'TIMEOUT' | 'AUTH_FAILED' | 'GATEWAY_ERROR', message: string) {
    super(message);
    this.name = 'OdooGatewayError';
    this.code = code;
  }
}

function readEnv(name: string): string | undefined {
  return process.env[name] || (import.meta.env as Record<string, string | undefined>)[name];
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Helper Timeout wrapper dùng .finally() giải phóng Timer an toàn
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  context: string,
  abortHandler?: () => void
): Promise<T> {
  let timer: NodeJS.Timeout;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      if (abortHandler) {
        try {
          abortHandler();
        } catch {
          // Safe ignore
        }
      }
      reject(new OdooGatewayError('TIMEOUT', `[Odoo Timeout] Request ${context} vượt quá ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

export class OdooClient {
  private uid: number | null = null;
  private uidCreatedAt = 0;
  private readonly UID_TTL_MS = 30 * 60 * 1000; // 30 phút TTL Cache

  private config: OdooConfig | null = null;
  private commonClient: xmlrpc.Client | null = null;
  private objectClient: xmlrpc.Client | null = null;

  private authPromise: Promise<number> | null = null;
  private envPrefix: string;

  // Socket Pool: Đáp ứng mượt mà từ vài chục đến hàng trăm đại lý concurrent
  private static httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 30000,
  });

  private static httpAgent = new http.Agent({
    keepAlive: true,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 30000,
  });

  constructor(envPrefix = 'ODOO') {
    this.envPrefix = envPrefix;
  }

  private getConfig(): OdooConfig {
    if (this.config) return this.config;

    const p = this.envPrefix;
    const url = readEnv(`${p}_URL`) || readEnv('ODOO_URL');
    const db = readEnv(`${p}_DB`) || readEnv('ODOO_DB');
    const user = readEnv(`${p}_USER`) || readEnv(`${p}_USERNAME`) || readEnv('ODOO_USER');
    const apiKey = readEnv(`${p}_API_KEY`) || readEnv(`${p}_PASSWORD`) || readEnv('ODOO_API_KEY');

    const config = { url, db, user, apiKey };

    const missing = Object.entries(config)
      .filter(([, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      throw new Error(`[Odoo Setup Error] Prefix '${p}': Thiếu biến môi trường [${missing.join(', ')}]`);
    }

    this.config = {
      url: normalizeBaseUrl(config.url as string),
      db: config.db as string,
      user: config.user as string,
      apiKey: config.apiKey as string,
    };

    this.initClients();
    return this.config;
  }

  /**
   * Khởi tạo XML-RPC Clients chuẩn dùng Public API.
   * Sử dụng (as any) cho tham số options để pass qua type-checker của @types/xmlrpc
   * mà không làm mất tính năng keepAlive agent ở runtime.
   */
  private initClients() {
    if (!this.config) return;

    const isHttps = this.config.url.startsWith('https://');
    const clientFactory = isHttps ? xmlrpc.createSecureClient : xmlrpc.createClient;
    const agent = isHttps ? OdooClient.httpsAgent : OdooClient.httpAgent;

    this.commonClient = clientFactory({
      url: `${this.config.url}/xmlrpc/2/common`,
      agent,
    } as any);

    this.objectClient = clientFactory({
      url: `${this.config.url}/xmlrpc/2/object`,
      agent,
    } as any);
  }

  private logServerError(context: string, error: unknown) {
  const errObj = error as {
    faultCode?: number;
    faultString?: string;
    message?: string;
    code?: string;
    errors?: unknown[];
  };

  console.error(`[Odoo Failure - ${this.envPrefix}] ${context}:`, {
    code: errObj.faultCode || errObj.code,
    message: errObj.faultString || errObj.message || String(error),
    name: error instanceof Error ? error.name : undefined,
    stack: error instanceof Error ? error.stack : undefined,
    causes:
      Array.isArray(errObj.errors)
        ? errObj.errors.map((e: any) => ({
            name: e?.name,
            code: e?.code,
            message: e?.message,
            syscall: e?.syscall,
            address: e?.address,
            port: e?.port,
          }))
        : undefined,
  });
}

  /**
   * Authenticate với Mutex Lock & Clean Refresh.
   * Tối ưu: Khi TTL hết hạn hoặc cần refresh, chỉ reset state chứ không vô tình rebuild client.
   */
  private async authenticate(forceRefresh = false): Promise<number> {
    const isExpired = Date.now() - this.uidCreatedAt > this.UID_TTL_MS;

    if (forceRefresh || isExpired) {
      this.uid = null;
      this.authPromise = null;
    }

    if (this.uid !== null) return this.uid;

    if (this.authPromise) {
      return this.authPromise;
    }

    const config = this.getConfig();

    this.authPromise = new Promise<number>((resolve, reject) => {
      this.commonClient!.methodCall(
        'authenticate',
        [config.db, config.user, config.apiKey, {}],
        (error, value) => {
          if (error) {
            this.logServerError('Auth Connection Error', error);
            return reject(new Error('Khong the ket noi den Odoo Server'));
          }

          if (!value) {
            this.logServerError('Auth Failed', 'Invalid Database or Credentials');
            return reject(new OdooGatewayError('AUTH_FAILED', 'Xac thuc Odoo that bai'));
          }

          this.uid = value as number;
          this.uidCreatedAt = Date.now();
          resolve(this.uid);
        }
      );
    }).finally(() => {
      this.authPromise = null;
    });

    return withTimeout(this.authPromise, 8000, `Auth [${this.envPrefix}]`);
  }

  private isAuthError(error: unknown): boolean {
    const str = String(error).toLowerCase();
    const errObj = error as { faultString?: string };
    const faultStr = (errObj.faultString || '').toLowerCase();

    const authPatterns = [
      'accesserror',
      'access denied',
      'accessdenied',
      'authentication',
      'invalid session',
      'session expired',
      'expired',
      'odoo.exceptions.accesserror',
    ];

    return authPatterns.some((pattern) => str.includes(pattern) || faultStr.includes(pattern));
  }

  /**
   * Tự động xác định timeout dựa theo đặc tính Read/Write nếu không được truyền vào thủ công.
   */
  private getDefaultTimeout(method: string): number {
    const writeMethods = ['create', 'write', 'unlink', 'action_', 'button_'];
    const isWrite = writeMethods.some((m) => method.startsWith(m) || method.includes(m));
    return isWrite ? 15000 : 8000; // Write: 15s, Read: 8s
  }

  public async executeKw(
    model: string,
    method: string,
    args: any[],
    kwargs: Record<string, any> = {},
    customTimeoutMs?: number
  ): Promise<any> {
    const config = this.getConfig();
    const timeoutMs = customTimeoutMs ?? this.getDefaultTimeout(method);

    const dispatchCall = (uid: number): Promise<any> => {
      const params = [config.db, uid, config.apiKey, model, method, args, kwargs];

      const callPromise = new Promise((resolve, reject) => {
        this.objectClient!.methodCall('execute_kw', params, (error, value) => {
          if (error) {
            this.logServerError(`executeKw [${model}.${method}]`, error);
            return reject(error);
          }
          resolve(value);
        });
      });

      return withTimeout(callPromise, timeoutMs, `${model}.${method}`);
    };

    try {
      const uid = await this.authenticate();
      return await dispatchCall(uid);
    } catch (err) {
      if (err instanceof OdooGatewayError) {
        throw err;
      }

      if (this.isAuthError(err)) {
        try {
          const freshUid = await this.authenticate(true);
          return await dispatchCall(freshUid);
        } catch (retryErr) {
          if (retryErr instanceof OdooGatewayError) throw retryErr;
        }
      }

      throw new OdooGatewayError('GATEWAY_ERROR', `Thao tac Odoo [${model}.${method}] that bai`);
    }
  }
}

// Singletons chia tách Reader và Writer
export const odooReader = new OdooClient('ODOO_READER');
export const odooWriter = new OdooClient('ODOO_WRITER');

// Fallback
export const odooClient = odooWriter;