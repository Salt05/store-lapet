// src/config/longterm-policy.ts: Chính sách áp dụng trong năm

export interface MilestoneTier {
  target: number;      // Mốc doanh số tích lũy (VNĐ)
  label: string;       // Hiển thị viết tắt (Tr, Tỷ)
  rate: number;        // % Chiết khấu thưởng
}

export interface LongtermPolicyConfig {
  year: number;
  yearMilestones: MilestoneTier[];
  quarterMilestones: MilestoneTier[];
}

export const LONGTERM_POLICY: LongtermPolicyConfig = {
  year: 2026,
  
  // Mốc doanh số NĂM
  yearMilestones: [
    { target: 100_000_000, label: '100Tr', rate: 5.0 },
    { target: 200_000_000, label: '200Tr', rate: 5.5 },
    { target: 400_000_000, label: '400Tr', rate: 6.0 },
    { target: 800_000_000, label: '800Tr', rate: 6.5 },
    { target: 1_600_000_000, label: '1.6Tỷ', rate: 7.0 },
    { target: 2_400_000_000, label: '2.4Tỷ', rate: 7.5 },
    { target: 3_200_000_000, label: '3.2Tỷ', rate: 8.0 },
    { target: 4_000_000_000, label: '4Tỷ', rate: 8.5 }
  ],

  // Mốc doanh số QUÝ
  quarterMilestones: [
    { target: 25_000_000, label: '25Tr', rate: 6.0 },
    { target: 50_000_000, label: '50Tr', rate: 6.5 },
    { target: 100_000_000, label: '100Tr', rate: 7.0 },
    { target: 200_000_000, label: '200Tr', rate: 7.5 },
    { target: 400_000_000, label: '400Tr', rate: 8.0 },
    { target: 600_000_000, label: '600Tr', rate: 8.5 },
    { target: 800_000_000, label: '800Tr', rate: 9.0 },
    { target: 1_000_000_000, label: '1Tỷ', rate: 9.5 }
  ]
};