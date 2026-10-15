// seed-directus.js
import { createDirectus, rest, staticToken, createItem, readItems, uploadFiles } from '@directus/sdk';
import fs from 'fs';
import path from 'path';

// 1. Cấu hình kết nối Directus
const DIRECTUS_URL = 'http://192.168.1.110:8055';
const ADMIN_TOKEN = 'r6AlM_0Pfh3VKpbxz6f2506phH74aQVh';

const client = createDirectus(DIRECTUS_URL)
  .with(rest())
  .with(staticToken(ADMIN_TOKEN));

// 2. DÁN MẢNG allProducts CỦA BẠN VÀO ĐÂY
const allProducts = [
{ 
    slug: 'que-gam-sach-rang-huong-sua', 
    name: 'Que gặm sạch răng hương sữa', 
    weight: '100g', 
    price: '30.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm không quấn gà', 
    img: '/b03.webp',
    specification:'15 que/túi',
    ingredients: 'Bột bắp, bột gạo, đậu Hà Lan, khoai lang, cà rốt, ức gà phi lê, dầu thực vật, Vitamin B12, Vitamin E, Glycerin, hương liệu tự nhiên và nhân tạo, Xanthan Gum, Sodium Pyrophosphate, Gelatin.',
    description: `Ức gà phi lê giàu protein, hỗ trợ duy trì cơ bắp và thể trạng khỏe mạnh cho bé
Ức gà phi lê cung cấp protein động vật cùng các axit amin thiết yếu, góp phần duy trì khối cơ, hỗ trợ thể trạng khỏe mạnh và cung cấp năng lượng cho những hoạt động hằng ngày của cún. Hương vị thịt gà tự nhiên còn giúp món thưởng thơm ngon và hấp dẫn hơn.

Đậu Hà Lan giàu protein thực vật, dễ tiêu hóa và dễ hấp thu
Đậu Hà Lan cung cấp protein thực vật và chất xơ, góp phần đa dạng nguồn dinh dưỡng trong sản phẩm. Khi được chế biến phù hợp, thành phần này giúp tạo kết cấu hài hòa và hỗ trợ hoạt động của hệ tiêu hóa.

Khoai lang giàu chất xơ, hỗ trợ hệ tiêu hóa khỏe mạnh
Khoai lang bổ sung chất xơ, giúp hỗ trợ nhu động ruột và duy trì hệ tiêu hóa khỏe mạnh. Vị ngọt dịu tự nhiên còn tạo nên hương vị hài hòa, giúp món thưởng dễ dàng chinh phục khẩu vị của cún.

Cà rốt giàu beta-carotene, hỗ trợ duy trì đôi mắt sáng khỏe
Cà rốt giàu beta-carotene, tiền chất được cơ thể chuyển hóa thành vitamin A, góp phần hỗ trợ thị lực, duy trì đôi mắt khỏe mạnh và bổ sung thêm dưỡng chất từ rau củ vào khẩu phần thưởng.

Vitamin B12 & Vitamin E bổ sung dưỡng chất thiết yếu cho cún
Vitamin B12 tham gia vào quá trình tạo tế bào máu và chuyển hóa dưỡng chất thành năng lượng. Vitamin E có đặc tính chống oxy hóa, góp phần bảo vệ tế bào và hỗ trợ duy trì sức khỏe tổng thể cho cún.

Sodium Pyrophosphate hỗ trợ hạn chế hình thành mảng bám và cao răng
Sodium Pyrophosphate giúp hạn chế sự lắng đọng của các khoáng chất trên bề mặt răng, từ đó góp phần giảm quá trình hình thành mảng bám và cao răng. Kết hợp với hoạt động nhai, sản phẩm hỗ trợ chăm sóc răng miệng cho cún hằng ngày.

Không chứa Rawhide Free (da bò sống), phù hợp làm snack nhai hằng ngày 
Sản phẩm không chứa Rawhide, sử dụng nền nguyên liệu từ thịt và thực vật giúp dễ tiêu hóa hơn. Đây là lựa chọn phù hợp cho những người nuôi đang tìm kiếm món snack nhai không da bò sống để bổ sung vào chế độ thưởng hằng ngày của cún.`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'que-gam-sach-rang-huong-pho-mai', 
    name: 'Que gặm sạch răng hương phô mai', 
    weight: '100g', 
    price: '30.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm không quấn gà', 
    img: '/b06.webp',
    specification:'15 que/túi',
    ingredients: 'Bột bắp, bột gạo, đậu Hà Lan, khoai lang, cà rốt, ức gà phi lê, dầu thực vật, Vitamin B12, Vitamin E, Glycerin, hương liệu tự nhiên và nhân tạo, Xanthan Gum, Sodium Pyrophosphate, Gelatin.',
    description: `Ức gà phi lê giàu protein, hỗ trợ duy trì cơ bắp và thể trạng khỏe mạnh cho bé
Ức gà phi lê cung cấp protein động vật cùng các axit amin thiết yếu, góp phần duy trì khối cơ, hỗ trợ thể trạng khỏe mạnh và cung cấp năng lượng cho những hoạt động hằng ngày của cún. Hương vị thịt gà tự nhiên còn giúp món thưởng thơm ngon và hấp dẫn hơn.

Đậu Hà Lan giàu protein thực vật, dễ tiêu hóa và dễ hấp thu
Đậu Hà Lan cung cấp protein thực vật và chất xơ, góp phần đa dạng nguồn dinh dưỡng trong sản phẩm. Khi được chế biến phù hợp, thành phần này giúp tạo kết cấu hài hòa và hỗ trợ hoạt động của hệ tiêu hóa.

Khoai lang giàu chất xơ, hỗ trợ hệ tiêu hóa khỏe mạnh
Khoai lang bổ sung chất xơ, giúp hỗ trợ nhu động ruột và duy trì hệ tiêu hóa khỏe mạnh. Vị ngọt dịu tự nhiên còn tạo nên hương vị hài hòa, giúp món thưởng dễ dàng chinh phục khẩu vị của cún.

Cà rốt giàu beta-carotene, hỗ trợ duy trì đôi mắt sáng khỏe
Cà rốt giàu beta-carotene, tiền chất được cơ thể chuyển hóa thành vitamin A, góp phần hỗ trợ thị lực, duy trì đôi mắt khỏe mạnh và bổ sung thêm dưỡng chất từ rau củ vào khẩu phần thưởng.

Vitamin B12 & Vitamin E bổ sung dưỡng chất thiết yếu cho cún
Vitamin B12 tham gia vào quá trình tạo tế bào máu và chuyển hóa dưỡng chất thành năng lượng. Vitamin E có đặc tính chống oxy hóa, góp phần bảo vệ tế bào và hỗ trợ duy trì sức khỏe tổng thể cho cún.

Sodium Pyrophosphate hỗ trợ hạn chế hình thành mảng bám và cao răng
Sodium Pyrophosphate giúp hạn chế sự lắng đọng của các khoáng chất trên bề mặt răng, từ đó góp phần giảm quá trình hình thành mảng bám và cao răng. Kết hợp với hoạt động nhai, sản phẩm hỗ trợ chăm sóc răng miệng cho cún hằng ngày.

Không chứa Rawhide Free (da bò sống), phù hợp làm snack nhai hằng ngày 
Sản phẩm không chứa Rawhide, sử dụng nền nguyên liệu từ thịt và thực vật giúp dễ tiêu hóa hơn. Đây là lựa chọn phù hợp cho những người nuôi đang tìm kiếm món snack nhai không da bò sống để bổ sung vào chế độ thưởng hằng ngày của cún.
`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'xuong-ban-chai-huong-sua', 
    name: 'Xương bàn chải hương sữa', 
    weight: '90g', 
    price: '25.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm không quấn gà', 
    img: '/e01.webp',
    specification:'6 xương/túi',
    ingredients: 'Tinh bột bắp, bột gạo, Glycerin, Sorbitol, Gluten lúa mì, Gelatin, Đạm đậu Hà Lan, Hương sữa, Calcium Carbonate, Dicalcium phosphate, Distilled Monoglyceride, Muối, Potassium sorbate, Chiết xuất hương thảo',
    description: `Protein thực vật từ đậu Hà Lan, dễ tiêu hóa cho bé cún
Đạm đậu Hà Lan cung cấp nguồn protein thực vật chất lượng, giúp bổ sung dinh dưỡng và hỗ trợ hệ tiêu hóa hoạt động hiệu quả. Nhờ khả năng dễ tiêu hóa và hấp thu, sản phẩm phù hợp để bé cún thưởng thức hằng ngày.

Canxi hỗ trợ xương và răng chắc khỏe
Calcium Carbonate và Dicalcium Phosphate bổ sung nguồn canxi cùng khoáng chất cần thiết, góp phần duy trì hệ xương và răng khỏe mạnh. Phù hợp sử dụng như món thưởng bổ sung trong chế độ ăn hằng ngày của bé cún.

Hương sữa thơm dịu, tăng sức hấp dẫn trong từng miếng nhai
Hương sữa mang đến mùi thơm dịu nhẹ, giúp tăng sự yêu thích của bé cún trong mỗi lần thưởng thức. Phù hợp làm món thưởng sau khi huấn luyện hoặc giữa các bữa ăn.

Chiết xuất hương thảo giúp bảo quản sản phẩm tốt hơn
Chiết xuất hương thảo là thành phần chống oxy hóa có nguồn gốc tự nhiên, góp phần duy trì chất lượng và độ tươi ngon của sản phẩm trong suốt quá trình bảo quản.

Kết cấu dai tự nhiên, hỗ trợ làm sạch răng khi nhai
Gelatin kết hợp cùng glycerin và sorbitol tạo độ dai vừa phải, giúp kéo dài thời gian nhai và tăng ma sát trên bề mặt răng. Từ đó góp phần hỗ trợ làm sạch răng và mang đến trải nghiệm nhai thú vị cho bé.`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'xuong-ban-chai-huong-pho-mai', 
    name: 'Xương bàn chải hương phô mai', 
    weight: '90g', 
    price: '25.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm không quấn gà', 
    img: '/e02.webp',
    specification:'6 xương/túi',
    ingredients: 'Tinh bột bắp, bột gạo, Glycerin, Sorbitol, Gluten lúa mì, Gelatin, Đạm đậu Hà Lan, Bột phô mai, Hương phô mai, Dicalcium phosphate, Distilled Monoglyceride, Chiếc xuất hương thảo, Muối, Potassium sorbate.',
    description: `Đạm đậu hà lan bổ sung protein dễ tiêu hóa cho thú cưng
Đạm đậu Hà Lan cung cấp nguồn protein thực vật, góp phần cân bằng dinh dưỡng và hỗ trợ duy trì thể trạng khỏe mạnh cho cún. Khi được chế biến phù hợp, thành phần này tương đối dễ tiêu hóa, phù hợp để bổ sung trong món thưởng hằng ngày.

Hương phô mai thơm béo, kích thích vị giác 
Hương phô mai mang đến mùi thơm béo dịu và hương vị mới lạ, giúp kích thích vị giác ngay từ khi mở gói. Đây là điểm nhấn giúp món thưởng trở nên hấp dẫn hơn, đặc biệt với những bé dễ chán các hương vị quen thuộc.

Bổ sung canxi hỗ trợ xương và răng chắc khỏe 
Canxi là khoáng chất thiết yếu, góp phần duy trì cấu trúc xương và răng chắc khỏe. Việc bổ sung canxi giúp tăng thêm giá trị dinh dưỡng cho món snack nhai hằng ngày của cún.

Thiết kế xương bàn chải có các rãnh giúp giảm mảng bám ở răng
Sản phẩm được tạo hình như một chiếc xương bàn chải với nhiều rãnh nổi trên bề mặt. Khi cún nhai, các rãnh tiếp xúc và tạo ma sát nhẹ với bề mặt răng, góp phần làm sạch cặn thức ăn và hạn chế sự tích tụ của mảng bám.

Độ dai vừa phải, kéo dài thời gian nhai thưởng
Kết cấu dai vừa phải giúp cún có thêm thời gian nhai và thưởng thức hương vị. Hoạt động nhai còn góp phần thỏa mãn nhu cầu nhai gặm tự nhiên, giúp trải nghiệm thưởng trở nên thú vị và trọn vẹn hơn. `,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
  slug: 'xuong-ban-chai-thit-ga-thit-huou', 
  name: 'Xương bàn chải thịt gà thịt hươu', 
  weight: '90g', 
  price: '25.000đ',
  category: 'Xương gặm', 
  group: 'Nhóm không quấn gà', 
  img: '/e03.webp',
  specification: '6 xương/túi',
  ingredients: 'Bột gạo, thịt gà, thịt hươu, glycerin, Calcium Carbonate, Dicalcium phosphate, đường maltose, đường IMO, distilled Monoglyceride, hương khói tự nhiên, tocopherol hỗn hợp, màu caramel.',
  description: `Thịt gà & thịt hươu giàu protein, hỗ trợ phát triển toàn diện
Nguồn protein từ thịt gà và thịt hươu cung cấp các axit amin thiết yếu, góp phần duy trì khối cơ, hỗ trợ phục hồi mô và nuôi dưỡng sức khỏe tổng thể. Đồng thời, thịt hươu còn bổ sung một số khoáng chất tự nhiên như sắt và kẽm, giúp hoàn thiện giá trị dinh dưỡng của món thưởng.

Đường IMO hỗ trợ hệ tiêu hóa khỏe mạnh
Đường IMO có đặc tính prebiotic, góp phần nuôi dưỡng lợi khuẩn đường ruột và hỗ trợ hệ tiêu hóa hoạt động hiệu quả. Nhờ đó, bé cún hấp thu dinh dưỡng tốt hơn trong mỗi lần thưởng thức.

Canxi hỗ trợ xương và răng chắc khỏe
Calcium Carbonate kết hợp cùng Dicalcium Phosphate bổ sung canxi và khoáng chất cần thiết, góp phần duy trì hệ xương và răng khỏe mạnh. Phù hợp sử dụng như món thưởng bổ sung trong chế độ ăn hằng ngày.

Kết cấu dai vừa phải, hỗ trợ làm sạch răng khi nhai
Sự kết hợp của glycerin cùng kết cấu xương bàn chải tạo độ dai vừa phải, giúp kéo dài thời gian nhai. Quá trình nhai góp phần hỗ trợ làm sạch bề mặt răng và mang lại trải nghiệm nhai thú vị cho bé cún.

Rawhide free giúp dễ tiêu hóa hơn so với các sản phẩm làm từ da bò thật
Công thức không chứa da bò sống, sử dụng tinh bột làm thành phần nền giúp sản phẩm có kết cấu phù hợp và dễ tiêu hóa hơn so với dòng da bò thông thường.`,
  target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn.',
  preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại.'
},
  { 
    slug: 'xuong-nhai-vi-ga', 
    name: 'Xương nhai vị gà', 
    weight: '150g', 
    price: '35.000đ',
    category: 'Bánh thưởng', 
    group: 'Nhóm không quấn gà', 
    img: '/d02.webp',
    ingredients: 'Gạo, Thịt gà, Glycerin, Thịt nai, Canxi Cacbonat, Dicalcium Phosphate, Hương khói tự nhiên, Tocopherols hỗn hợp, Hương vị tự nhiên',
    description: ``,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'gap-doi-que-nhai-vi-ga', 
    name: 'Gấp đôi que nhai vị gà', 
    weight: '200g', 
    price: '43.000đ',
    category: 'Bánh thưởng', 
    group: 'Nhóm không quấn gà', 
    img: '/d03.webp',
    ingredients: 'Gạo, Thịt gà, Glycerin, Thịt nai, Canxi Cacbonat, Dicalcium Phosphate, Hương khói tự nhiên, Tocopherols hỗn hợp, Hương vị tự nhiên',
    description: `Sự kết hợp từ thịt gà và thịt nai giàu protein
Bánh thưởng thịt nai vị gà cung cấp protein động vật và các axit amin cần thiết, góp phần duy trì khối cơ, thể trạng khỏe khoắn và khả năng vận động của cún. Hương vị thịt nai đặc trưng kết hợp cùng thịt gà thơm ngon còn giúp kích thích vị giác, phù hợp với những bé kén ăn hoặc dễ chán các món thưởng quen thuộc.

Vi chất từ thịt nai hỗ trợ chuyển hóa năng lượng
Thịt nai cung cấp sắt, kẽm và vitamin nhóm B, góp phần hỗ trợ quá trình tạo máu, duy trì chức năng miễn dịch và chuyển hóa dưỡng chất thành năng lượng cho các hoạt động hằng ngày.

Bổ sung canxi và phospho hỗ trợ xương, răng
Canxi cacbonat và dicalcium phosphate cung cấp canxi cùng phospho, hai khoáng chất quan trọng góp phần duy trì cấu trúc xương và răng khỏe mạnh.

Hương vị khói tự nhiên kích thích khứu giác
Hương khói tự nhiên tạo nên mùi thơm nướng đậm đà, làm nổi bật vị thịt gà và thịt nai, giúp cún hào hứng ngay khi mở gói.

Kết cấu mềm dai, dễ nhai và dễ thưởng
Glycerin giúp bánh duy trì độ mềm ẩm vừa phải, hạn chế khô cứng và tạo cảm giác nhai thú vị. Sản phẩm phù hợp làm bánh thưởng hằng ngày hoặc phần thưởng tạo động lực khi cún hoàn thành khẩu lệnh.

Công thức bổ sung canxi và phospho hỗ trợ cho xương và răng:  góp phần duy trì cấu trúc xương, răng khỏe mạnh.

Kết cấu dai nhẹ: phù hợp để thưởng đúng thời điểm khi cún ngồi, bắt tay, đi vệ sinh đúng chỗ hoặc hoàn thành khẩu lệnh. `,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'que-gam-da-heo-quan-ga', 
    name: 'Que gặm da heo quấn gà', 
    weight: '100g', 
    price: '45.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm quấn gà', 
    img: '/c24.webp',
    specification:'10 xương/túi',
    ingredients: 'Da heo, da bò, thịt gà, glycerin, đường, muối, hương khói, carmine (120), màu caramel, potassium sorbate',
    description: `Da bò và da heo tự nhiên phù hợp bản năng gặm nhai của bé 
Được làm từ da bò tự nhiên, que gặm sở hữu độ dai đặc trưng, giúp kéo dài thời gian nhai và đáp ứng nhu cầu gặm nhai bản năng của cún. Quá trình nhai
sẽ tạo ma sát tự nhiên với bề mặt răng, góp phần hỗ trợ làm sạch các mảng bám mềm

Lớp thịt thật mang đến nguồn protein chất lượng 
Lớp thịt gà thật được quấn bên ngoài da bò, mang đến hương vị tự nhiên cùng nguồn protein động vật chất lượng. Sự kết hợp giữa vị 
thịt thơm ngon và kết cấu dai giúp tăng sức hấp dẫn trong mỗi lần thưởng.

Hai tầng hương vị kích thích nhai lâu, hỗ trợ cơ hàm chắc khỏe 
Sự hòa quyện giữa thịt gà mềm thơm và lõi da bò dai tự nhiên tạo nên trải nghiệm nhiều tầng hương vị. Mỗi lần gặm đều mang lại cảm giác mới mẻ, giúp cún hứng thú nhai lâu hơn.

Món thưởng vừa ngon vừa dai nhẹ để đáp ứng nhu cầu gặm nhai
Không chỉ là một món snack, que gặm da bò quấn gà còn mang đến khoảng thời gian gặm nhai thú vị, phù hợp làm phần thưởng hoặc món ăn vặt hằng ngày cho cún.
 `,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'que-gam-ga-vien', 
    name: 'Que gặm gà viên', 
    weight: '60g', 
    price: '45.000đ', 
    category: 'Xương gặm', 
    group: 'Nhóm quấn gà', 
    img: '/c11.webp',
    specification:'5 xương/túi',
    ingredients: 'Da bò, Thịt gà, Gạo, Đạm đậu hà lan, Glycerin, Muối, Chất bảo quản (Potassium Sorbate)',
    description: `Protein từ thịt gà và da bò hỗ trợ duy trì cơ bắp
Thịt gà kết hợp cùng da bò cung cấp protein động vật và các axit amin, góp phần duy trì khối cơ, thể trạng khỏe khoắn và khả năng vận động của cún.

Đạm đậu Hà Lan đa dạng nguồn protein giúp cún dễ tiêu hóa
Đạm đậu Hà Lan bổ sung protein thực vật, kết hợp cùng protein động vật để đa dạng nguồn đạm và hỗ trợ cún duy trì trạng thái năng động mỗi ngày.

Gạo bổ sung năng lượng hằng ngày
Carbohydrate từ gạo cung cấp năng lượng cho các hoạt động vui chơi, vận động và huấn luyện; đồng thời góp phần tạo cấu trúc ổn định cho sản phẩm.

Kết cấu dai chắc hỗ trợ chăm sóc răng miệng
Da bò tạo độ dai tự nhiên, giúp kéo dài thời gian nhai và tăng ma sát cơ học với bề mặt răng, góp phần làm sạch thức ăn thừa và hạn chế mảng bám mềm.

Nhai lâu hơn giúp giải tỏa năng lượng và giảm buồn chán
Hoạt động gặm nhai giúp đáp ứng bản năng tự nhiên, tạo sự tập trung và mang đến khoảng thời gian thư giãn cho cún; từ đó góp phần hạn chế hành vi cắn phá đồ đạc do buồn chán.`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'que-xoan-da-bo-phu-thit-ga', 
    name: 'Que xoắn da bò phủ thịt gà', 
    weight: '85g', 
    price: '52.000đ', 
    category: 'Xương gặm', 
    group: 'Nhóm quấn gà', 
    img: '/c17.webp',
    specification:'5 xương/túi',
    ingredients: 'Ức gà, collagen tinh chế, bột bắp, glycerin, gan gà, muối ',
    description: `Ức gà và gan gà bổ sung protein, gấp đôi ngon miệng
Ức gà cung cấp protein động vật cùng các axit amin thiết yếu, góp phần duy trì cơ bắp và thể trạng năng động. Gan gà tạo hương vị đậm đà, đồng thời bổ sung sắt, vitamin A và vitamin nhóm B tự nhiên, giúp món thưởng hấp dẫn hơn với những bé kén ăn.

Collagen thủy phân hỗ trợ đẹp da và lông 
Collagen tinh chế cung cấp các peptide cùng axit amin đặc trưng như glycine và proline, đồng thời góp phần tạo kết cấu dai nhẹ, mang đến trải nghiệm nhai thú vị cho cún.

Glycerin - giữ bánh mềm ẩm, dễ nhai
Glycerin giúp duy trì độ ẩm, hạn chế bánh bị khô cứng và tạo kết cấu mềm dai vừa miệng. Bánh thuận tiện cắt nhỏ để kiểm soát khẩu phần hoặc thưởng đúng thời điểm khi cún hoàn thành khẩu lệnh.

 
Với vị ức gà thơm ngon, gan gà đậm đà và collagen tinh chế, sản phẩm là lựa chọn phù hợp làm món thưởng hằng ngày, giúp mỗi khoảnh khắc khen thưởng trở nên hấp dẫn và đáng mong chờ hơn.`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'que-nhai-quan-ga', 
    name: 'Que nhai quấn gà', 
    weight: '150g', 
    price: '43.000đ',
    category: 'Bánh thưởng', 
    group: 'Nhóm quấn gà', 
    img: '/d01.webp',
    specification:'24 túi/thùng',
    ingredients: 'Gạo, Thịt gà, Glycerin, Thịt nai, Canxi Cacbonat, Dicalcium Phosphate, Hương khói tự nhiên, Tocopherols hỗn hợp, Hương vị tự nhiên',
    description: `Thịt nai mới lạ tạo nên sự khác biệt khi trải nghiệm
Hương vị thịt nai mới lạ, ít chất béo, cung cấp sắt, kẽm và vitamin B12, góp phần hỗ trợ quá trình tạo máu và duy trì cơ bắp săn chắc. Mùi vị đặc trưng còn giúp kích thích vị giác, phù hợp với những bé kén ăn.

Thịt gà chất lượng cao giàu protein giúp duy trì cơ bắp khỏe mạnh
Nguồn protein động vật từ thịt gà cung cấp các axit amin cần thiết, giúp duy trì khối cơ, hỗ trợ chuyển hóa năng lượng và giữ cho cún luôn khỏe khoắn, năng động.

Bổ sung canxi và phospho hỗ trợ xương, răng chắc khỏe
Gạo cung cấp carbohydrate cho hoạt động hằng ngày; canxi kết hợp phospho góp phần duy trì cấu trúc xương và răng chắc khỏe, đặc biệt cần thiết trong giai đoạn cún phát triển.

Thịt gà thật quấn quanh lõi bánh mềm dai thỏa mãn nhu cầu gặm tự nhiên
Lớp thịt gà thơm ngon bao quanh lõi bánh tạo nên kết cấu mềm dai nhiều tầng, kích thích cún nhai lâu và hào hứng hơn. Quá trình nhai còn giúp vận động cơ hàm và thỏa mãn nhu cầu nhai gặm tự nhiên.

Mùi hương khói giúp nâng tầm vị thịt, tăng sức hấp dẫn với cún
Sự hòa quyện từ hương khói tự nhiên kết hợp cùng các thành phần thịt thật tạo nên mùi thơm nướng cuốn hút, giúp kích thích khứu giác và khiến cún hào hứng ngay khi mở gói.
`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'que-xoan-vi-sua-quan-ga', 
    name: 'Que xoắn vị sữa quấn gà', 
    weight: '100g', 
    price: '45.000đ',
    category: 'Bánh thưởng', 
    group: 'Nhóm quấn gà', 
    img: '/db01.webp',
    specification:'36 túi/thùng',
    ingredients: 'Tinh bột bắp, thịt gà, bột đậu hà lan, glycerin, sorbitol, bột đậu hà lan, Fructose, Gelatin, đường Maltose, đường IMO, muối, hương sữa, hương thịt gà, bột cà rốt, bột khoai lang, carrageenan, Dicalcium phosphate...',
    description: `Thiết kế dạng xương nơ mini dễ tiếp cận với những dòng chó nhỏ
Khi cún cắn, kéo và xoay xương, bề mặt da cọ xát với thân răng, góp phần làm bong thức ăn thừa và hạn chế mảng bám mềm. Sản phẩm không loại bỏ cao răng đã hình thành và không thay thế việc chải răng.

Cấu trúc sợi collagen nén chặt giúp kéo dài thời gian gặm
Các sợi collagen trong da bò được ép sát, tạo kết cấu đặc và khó tách. Cún phải liên tục cắn, kéo và làm mềm từng lớp bằng nước bọt, nhờ đó thời gian gặm kéo dài hơn snack mềm.

Mềm dần khi nhai, duy trì sự hứng thú
Bề mặt da hút ẩm và mềm dần trong khi phần lõi vẫn giữ độ chắc. Sự thay đổi kết cấu giúp cún cảm nhận nhiều trạng thái nhai, duy trì sự tập trung lâu hơn.

Vận động cơ hàm và thỏa mãn nhu cầu nhai mạnh
Kết cấu dai buộc cún phối hợp răng cửa, răng nanh và răng hàm để giữ, kéo và nghiền. Quá trình này giúp cơ hàm vận động thường xuyên, phù hợp với những bé có lực nhai tốt.

Hỗ trợ chuyển hướng hành vi cắn phá
Thời gian gặm lâu tạo cho cún một hoạt động để tập trung, giúp giải tỏa buồn chán và chuyển sự chú ý khỏi giày dép, bàn ghế cùng đồ dùng trong nhà.

Cung cấp collagen và protein cấu trúc
Da bò cung cấp collagen giàu glycine và proline, bổ sung axit amin tham gia duy trì da và mô liên kết. 
`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'xuong-da-bo-sua-6', 
    name: 'Xương da bò sữa 6"', 
    weight: '60-70g', 
    price: '29.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm da bò', 
    img: '/c22.webp',
    specification:'15cm/xương',
    ingredients: 'Da bò tự nhiên',
    description: `Xương da bò gặm lâu và phù hợp với cún có lực nhai tốt
Xương da bò được tạo nên từ Rawhide tự nhiên với kết cấu dày chắc và thiết kế dáng xương dễ cầm giữ. Sản phẩm phù hợp với những chú chó có nhu cầu gặm cao, thường xuyên buồn chán hoặc yêu thích các món nhai kéo dài.

Rawhide tự nhiên giữ trọn hương vị đặc trưng của da bò
Nguyên liệu rawhide tự nhiên được xử lý nhằm duy trì độ dai cùng mùi vị đặc trưng của da. Khi tiếp xúc với nước bọt, bề mặt xương mềm dần và giải phóng hương vị theo từng lần nhai, giúp cún duy trì sự hứng thú trong suốt quá trình gặm.

Kết cấu dày chắc giúp kéo dài thời gian gặm
So với các loại que da bò mỏng, xương da bò có kết cấu dày và chắc hơn, khiến cún cần nhiều thời gian để cắn, kéo và làm mềm từng lớp da. Đây là lựa chọn phù hợp với những bé có lực hàm tốt và nhanh ăn hết các món thưởng thông thường.

Tăng diện tích tiếp xúc với bề mặt răng, làm bong thức ăn thừa và hạn chế tích tụ mảng bám mềm
Trong quá trình gặm, các lớp da bò tiếp xúc và tạo ma sát với bề mặt răng. Hoạt động này góp phần làm bong thức ăn thừa và hạn chế sự tích tụ của mảng bám mềm, hỗ trợ chăm sóc răng miệng cho cún.

Độ dai giúp cơ hàm được vận động thường xuyên
Các chuyển động cắn, kéo và nghiền giúp cơ hàm hoạt động liên tục trong lúc nhai. Kết cấu dày chắc của xương da bò 6 ly mang đến trải nghiệm gặm rõ rệt, phù hợp với những chú chó thích vận động hàm và có nhu cầu nhai mạnh.

Thỏa mãn bản năng nhai và hạn chế cắn phá
Xương da bò tạo cho cún một vật được phép gặm, giúp chuyển hướng sự chú ý khỏi giày dép, bàn ghế và những vật dụng trong nhà. Khi được kết hợp cùng vận động và huấn luyện phù hợp, sản phẩm có thể hỗ trợ hạn chế hành vi cắn phá do buồn chán hoặc dư thừa năng lượng.

Giúp cún thư giãn trong thời gian tự chơi
Những chuyển động nhai lặp lại giúp cún tập trung vào một hoạt động cụ thể, từ đó giải phóng năng lượng và giảm cảm giác buồn chán. Sản phẩm phù hợp sử dụng trong những khoảng thời gian cún cần tự chơi nhưng vẫn phải có người giám sát.`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'xuong-da-bo-sua-8', 
    name: 'Xương da bò sữa 8"', 
    weight: '70-80g', 
    price: '42.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm da bò', 
    img: '/c33.webp',
    specification:'20cm/xương',
    ingredients: 'Da bò tự nhiên',
    description: `Xương da bò gặm lâu và phù hợp với cún có lực nhai tốt
Xương da bò được tạo nên từ Rawhide tự nhiên với kết cấu dày chắc và thiết kế dáng xương dễ cầm giữ. Sản phẩm phù hợp với những chú chó có nhu cầu gặm cao, thường xuyên buồn chán hoặc yêu thích các món nhai kéo dài.

Rawhide tự nhiên giữ trọn hương vị đặc trưng của da bò
Nguyên liệu Rawhide tự nhiên được xử lý nhằm duy trì độ dai cùng mùi vị đặc trưng của da. Khi tiếp xúc với nước bọt, bề mặt xương mềm dần và giải phóng hương vị theo từng lần nhai, giúp cún duy trì sự hứng thú trong suốt quá trình gặm.

Kết cấu dày chắc giúp kéo dài thời gian gặm
So với các loại que da bò mỏng, xương da bò có kết cấu dày và chắc hơn, khiến cún cần nhiều thời gian để cắn, kéo và làm mềm từng lớp da. Đây là lựa chọn phù hợp với những bé có lực hàm tốt và nhanh ăn hết các món thưởng thông thường.

Tăng diện tích tiếp xúc với bề mặt răng, làm bong thức ăn thừa và hạn chế tích tụ mảng bám mềm
Trong quá trình gặm, các lớp da bò tiếp xúc và tạo ma sát với bề mặt răng. Hoạt động này góp phần làm bong thức ăn thừa và hạn chế sự tích tụ của mảng bám mềm, hỗ trợ chăm sóc răng miệng cho cún.

Độ dai giúp cơ hàm được vận động thường xuyên
Các chuyển động cắn, kéo và nghiền giúp cơ hàm hoạt động liên tục trong lúc nhai. Kết cấu dày chắc của xương da bò 6 ly mang đến trải nghiệm gặm rõ rệt, phù hợp với những chú chó thích vận động hàm và có nhu cầu nhai mạnh.

Thỏa mãn bản năng nhai và hỗ trợ hạn chế cắn phá
Xương da bò tạo cho cún một vật được phép gặm, giúp chuyển hướng sự chú ý khỏi giày dép, bàn ghế và những vật dụng trong nhà. Khi được kết hợp cùng vận động và huấn luyện phù hợp, sản phẩm có thể hỗ trợ hạn chế hành vi cắn phá do buồn chán hoặc dư thừa năng lượng.

Giúp cún thư giãn trong thời gian tự chơi
Những chuyển động nhai lặp lại giúp cún tập trung vào một hoạt động cụ thể, từ đó giải phóng năng lượng và giảm cảm giác buồn chán. Sản phẩm phù hợp sử dụng trong những khoảng thời gian cún cần tự chơi nhưng vẫn phải có người giám sát.`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'xuong-da-bo-sua-10', 
    name: 'Xương da bò sữa 10"', 
    weight: '90-100g', 
    price: '55.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm da bò', 
    img: '/c34.webp',
    specification:'25cm/xương',
    ingredients: 'Da bò tự nhiên',
    description: `Xương da bò gặm lâu và phù hợp với cún có lực nhai tốt
Xương da bò được tạo nên từ Rawhide tự nhiên với kết cấu dày chắc và thiết kế dáng xương dễ cầm giữ. Sản phẩm phù hợp với những chú chó có nhu cầu gặm cao, thường xuyên buồn chán hoặc yêu thích các món nhai kéo dài.

Rawhide tự nhiên giữ trọn hương vị đặc trưng của da bò
Nguyên liệu Rawhide tự nhiên được xử lý nhằm duy trì độ dai cùng mùi vị đặc trưng của da. Khi tiếp xúc với nước bọt, bề mặt xương mềm dần và giải phóng hương vị theo từng lần nhai, giúp cún duy trì sự hứng thú trong suốt quá trình gặm.

Kết cấu dày chắc giúp kéo dài thời gian gặm
So với các loại que da bò mỏng, xương da bò có kết cấu dày và chắc hơn, khiến cún cần nhiều thời gian để cắn, kéo và làm mềm từng lớp da. Đây là lựa chọn phù hợp với những bé có lực hàm tốt và nhanh ăn hết các món thưởng thông thường.

Tăng diện tích tiếp xúc với bề mặt răng, làm bong thức ăn thừa và hạn chế tích tụ mảng bám mềm
Trong quá trình gặm, các lớp da bò tiếp xúc và tạo ma sát với bề mặt răng. Hoạt động này góp phần làm bong thức ăn thừa và hạn chế sự tích tụ của mảng bám mềm, hỗ trợ chăm sóc răng miệng cho cún.

Độ dai giúp cơ hàm được vận động thường xuyên
Các chuyển động cắn, kéo và nghiền giúp cơ hàm hoạt động liên tục trong lúc nhai. Kết cấu dày chắc của xương da bò 6 ly mang đến trải nghiệm gặm rõ rệt, phù hợp với những chú chó thích vận động hàm và có nhu cầu nhai mạnh.

Thỏa mãn bản năng nhai và hỗ trợ hạn chế cắn phá
Xương da bò tạo cho cún một vật được phép gặm, giúp chuyển hướng sự chú ý khỏi giày dép, bàn ghế và những vật dụng trong nhà. Khi được kết hợp cùng vận động và huấn luyện phù hợp, sản phẩm có thể hỗ trợ hạn chế hành vi cắn phá do buồn chán hoặc dư thừa năng lượng.

Giúp cún thư giãn trong thời gian tự chơi
Những chuyển động nhai lặp lại giúp cún tập trung vào một hoạt động cụ thể, từ đó giải phóng năng lượng và giảm cảm giác buồn chán. Sản phẩm phù hợp sử dụng trong những khoảng thời gian cún cần tự chơi nhưng vẫn phải có người giám sát.`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'xuong-da-bo-sua-12', 
    name: 'Xương da bò sữa 12"', 
    weight: '110-120g', 
    price: '57.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm da bò', 
    img: '/c37.webp',
    specification:'30cm/xương',
    ingredients: 'Da bò tự nhiên',
    description: `Xương da bò gặm lâu và phù hợp với cún có lực nhai tốt
Xương da bò được tạo nên từ Rawhide tự nhiên với kết cấu dày chắc và thiết kế dáng xương dễ cầm giữ. Sản phẩm phù hợp với những chú chó có nhu cầu gặm cao, thường xuyên buồn chán hoặc yêu thích các món nhai kéo dài.

Rawhide tự nhiên giữ trọn hương vị đặc trưng của da bò
Nguyên liệu Rawhide tự nhiên được xử lý nhằm duy trì độ dai cùng mùi vị đặc trưng của da. Khi tiếp xúc với nước bọt, bề mặt xương mềm dần và giải phóng hương vị theo từng lần nhai, giúp cún duy trì sự hứng thú trong suốt quá trình gặm.

Kết cấu dày chắc giúp kéo dài thời gian gặm
So với các loại que da bò mỏng, xương da bò có kết cấu dày và chắc hơn, khiến cún cần nhiều thời gian để cắn, kéo và làm mềm từng lớp da. Đây là lựa chọn phù hợp với những bé có lực hàm tốt và nhanh ăn hết các món thưởng thông thường.

Tăng diện tích tiếp xúc với bề mặt răng, làm bong thức ăn thừa và hạn chế tích tụ mảng bám mềm
Trong quá trình gặm, các lớp da bò tiếp xúc và tạo ma sát với bề mặt răng. Hoạt động này góp phần làm bong thức ăn thừa và hạn chế sự tích tụ của mảng bám mềm, hỗ trợ chăm sóc răng miệng cho cún.

Độ dai giúp cơ hàm được vận động thường xuyên
Các chuyển động cắn, kéo và nghiền giúp cơ hàm hoạt động liên tục trong lúc nhai. Kết cấu dày chắc của xương da bò 6 ly mang đến trải nghiệm gặm rõ rệt, phù hợp với những chú chó thích vận động hàm và có nhu cầu nhai mạnh.

Thỏa mãn bản năng nhai và hỗ trợ hạn chế cắn phá
Xương da bò tạo cho cún một vật được phép gặm, giúp chuyển hướng sự chú ý khỏi giày dép, bàn ghế và những vật dụng trong nhà. Khi được kết hợp cùng vận động và huấn luyện phù hợp, sản phẩm có thể hỗ trợ hạn chế hành vi cắn phá do buồn chán hoặc dư thừa năng lượng.

Giúp cún thư giãn trong thời gian tự chơi
Những chuyển động nhai lặp lại giúp cún tập trung vào một hoạt động cụ thể, từ đó giải phóng năng lượng và giảm cảm giác buồn chán. Sản phẩm phù hợp sử dụng trong những khoảng thời gian cún cần tự chơi nhưng vẫn phải có người giám sát.`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'xuong-ep-da-bo-tu-nhien-6', 
    name: 'Xương ép da bò tự nhiên 6"', 
    weight: '60-70g', 
    price: '35.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm da bò', 
    img: '/c35.webp',
    specification:'15cm/xương',
    ingredients: 'Da bò tự nhiên',
    description: `Cấu trúc sợi collagen nén chặt giúp kéo dài thời gian gặm
Các sợi collagen trong da bò được ép sát, tạo kết cấu đặc và khó tách. Cún phải liên tục cắn, kéo và làm mềm từng lớp bằng nước bọt, nhờ đó thời gian gặm kéo dài hơn snack mềm.

Mềm dần khi nhai, duy trì sự hứng thú
Bề mặt da hút ẩm và mềm dần trong khi phần lõi vẫn giữ độ chắc. Sự thay đổi kết cấu giúp cún cảm nhận nhiều trạng thái nhai, duy trì sự tập trung lâu hơn.

Ma sát kéo dài hỗ trợ làm sạch bề mặt răng
Khi cún cắn, kéo và xoay xương, bề mặt da cọ xát với thân răng, góp phần làm bong thức ăn thừa và hạn chế mảng bám mềm. Sản phẩm không loại bỏ cao răng đã hình thành và không thay thế việc chải răng.

Vận động cơ hàm và thỏa mãn nhu cầu nhai mạnh
Kết cấu dai buộc cún phối hợp răng cửa, răng nanh và răng hàm để giữ, kéo và nghiền. Quá trình này giúp cơ hàm vận động thường xuyên, phù hợp với những bé có lực nhai tốt.

Hỗ trợ chuyển hướng hành vi cắn phá
Thời gian gặm lâu tạo cho cún một hoạt động để tập trung, giúp giải tỏa buồn chán và chuyển sự chú ý khỏi giày dép, bàn ghế cùng đồ dùng trong nhà.

Cung cấp collagen và protein cấu trúc
Da bò cung cấp collagen giàu glycine và proline, bổ sung axit amin tham gia duy trì da và mô liên kết. .`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'xuong-ep-da-bo-tu-nhien-8', 
    name: 'Xương ép da bò tự nhiên 8"', 
    weight: '130-140g', 
    price: '52.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm da bò', 
    img: '/c38.webp',
    specification:'20cm/xương',
    ingredients: 'Da bò tự nhiên',
    description: `Cấu trúc sợi collagen nén chặt giúp kéo dài thời gian gặm
Các sợi collagen trong da bò được ép sát, tạo kết cấu đặc và khó tách. Cún phải liên tục cắn, kéo và làm mềm từng lớp bằng nước bọt, nhờ đó thời gian gặm kéo dài hơn snack mềm.

Mềm dần khi nhai, duy trì sự hứng thú
Bề mặt da hút ẩm và mềm dần trong khi phần lõi vẫn giữ độ chắc. Sự thay đổi kết cấu giúp cún cảm nhận nhiều trạng thái nhai, duy trì sự tập trung lâu hơn.

Ma sát kéo dài hỗ trợ làm sạch bề mặt răng
Khi cún cắn, kéo và xoay xương, bề mặt da cọ xát với thân răng, góp phần làm bong thức ăn thừa và hạn chế mảng bám mềm. Sản phẩm không loại bỏ cao răng đã hình thành và không thay thế việc chải răng.

Vận động cơ hàm và thỏa mãn nhu cầu nhai mạnh
Kết cấu dai buộc cún phối hợp răng cửa, răng nanh và răng hàm để giữ, kéo và nghiền. Quá trình này giúp cơ hàm vận động thường xuyên, phù hợp với những bé có lực nhai tốt.

Hỗ trợ chuyển hướng hành vi cắn phá
Thời gian gặm lâu tạo cho cún một hoạt động để tập trung, giúp giải tỏa buồn chán và chuyển sự chú ý khỏi giày dép, bàn ghế cùng đồ dùng trong nhà.

Cung cấp collagen và protein cấu trúc
Da bò cung cấp collagen giàu glycine và proline, bổ sung axit amin tham gia duy trì da và mô liên kết. `,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'xuong-ep-da-bo-tu-nhien-10', 
    name: 'Xương ép da bò tự nhiên 10"', 
    weight: '220-240g', 
    price: '82.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm da bò', 
    img: '/c39.webp',
    specification:'25cm/xương',
    ingredients: 'Da bò tự nhiên',
    description: `Cấu trúc sợi collagen nén chặt giúp kéo dài thời gian gặm
Các sợi collagen trong da bò được ép sát, tạo kết cấu đặc và khó tách. Cún phải liên tục cắn, kéo và làm mềm từng lớp bằng nước bọt, nhờ đó thời gian gặm kéo dài hơn snack mềm.

Mềm dần khi nhai, duy trì sự hứng thú
Bề mặt da hút ẩm và mềm dần trong khi phần lõi vẫn giữ độ chắc. Sự thay đổi kết cấu giúp cún cảm nhận nhiều trạng thái nhai, duy trì sự tập trung lâu hơn.

Ma sát kéo dài hỗ trợ làm sạch bề mặt răng
Khi cún cắn, kéo và xoay xương, bề mặt da cọ xát với thân răng, góp phần làm bong thức ăn thừa và hạn chế mảng bám mềm. Sản phẩm không loại bỏ cao răng đã hình thành và không thay thế việc chải răng.

Vận động cơ hàm và thỏa mãn nhu cầu nhai mạnh
Kết cấu dai buộc cún phối hợp răng cửa, răng nanh và răng hàm để giữ, kéo và nghiền. Quá trình này giúp cơ hàm vận động thường xuyên, phù hợp với những bé có lực nhai tốt.

Hỗ trợ chuyển hướng hành vi cắn phá
Thời gian gặm lâu tạo cho cún một hoạt động để tập trung, giúp giải tỏa buồn chán và chuyển sự chú ý khỏi giày dép, bàn ghế cùng đồ dùng trong nhà.

Cung cấp collagen và protein cấu trúc
Da bò cung cấp collagen giàu glycine và proline, bổ sung axit amin tham gia duy trì da và mô liên kết. Tuy nhiên, giá trị chính của sản phẩm vẫn là hoạt động gặm nhai, không thay thế nguồn protein từ thịt hoặc bữa ăn chính.`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'xuong-ep-da-bo-tu-nhien-3', 
    name: 'Xương ép da bò tự nhiên 3"', 
    weight: '80g', 
    price: '44.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm da bò', 
    img: '/c36.webp',
    specification:'4 xương/túi',
    ingredients: 'Da bò tự nhiên',
    description: `Thiết kế dạng xương mini dễ tiếp cận với những dòng chó nhỏ
Khi cún cắn, kéo và xoay xương, bề mặt da cọ xát với thân răng, góp phần làm bong thức ăn thừa và hạn chế mảng bám mềm. Sản phẩm không loại bỏ cao răng đã hình thành và không thay thế việc chải răng.

Cấu trúc sợi collagen nén chặt giúp kéo dài thời gian gặm
Các sợi collagen trong da bò được ép sát, tạo kết cấu đặc và khó tách. Cún phải liên tục cắn, kéo và làm mềm từng lớp bằng nước bọt, nhờ đó thời gian gặm kéo dài hơn snack mềm.

Mềm dần khi nhai, duy trì sự hứng thú
Bề mặt da hút ẩm và mềm dần trong khi phần lõi vẫn giữ độ chắc. Sự thay đổi kết cấu giúp cún cảm nhận nhiều trạng thái nhai, duy trì sự tập trung lâu hơn.

Vận động cơ hàm và thỏa mãn nhu cầu nhai mạnh
Kết cấu dai buộc cún phối hợp răng cửa, răng nanh và răng hàm để giữ, kéo và nghiền. Quá trình này giúp cơ hàm vận động thường xuyên, phù hợp với những bé có lực nhai tốt.

Hỗ trợ chuyển hướng hành vi cắn phá
Thời gian gặm lâu tạo cho cún một hoạt động để tập trung, giúp giải tỏa buồn chán và chuyển sự chú ý khỏi giày dép, bàn ghế cùng đồ dùng trong nhà.

Cung cấp collagen và protein cấu trúc
Da bò cung cấp collagen giàu glycine và proline, bổ sung axit amin tham gia duy trì da và mô liên kết. `,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'xuong-no-da-bo-mini-trang', 
    name: 'Xương nơ da bò mini trắng', 
    weight: '60-70g', 
    price: '30.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm da bò', 
    img: '/c42.webp',
    specification:'4 xương/túi',
    ingredients: 'Da bò tự nhiên',
    description: `Thiết kế dạng xương nơ mini dễ tiếp cận với những dòng chó nhỏ
Khi cún cắn, kéo và xoay xương, bề mặt da cọ xát với thân răng, góp phần làm bong thức ăn thừa và hạn chế mảng bám mềm. Sản phẩm không loại bỏ cao răng đã hình thành và không thay thế việc chải răng.

Cấu trúc sợi collagen nén chặt giúp kéo dài thời gian gặm
Các sợi collagen trong da bò được ép sát, tạo kết cấu đặc và khó tách. Cún phải liên tục cắn, kéo và làm mềm từng lớp bằng nước bọt, nhờ đó thời gian gặm kéo dài hơn snack mềm.

Mềm dần khi nhai, duy trì sự hứng thú
Bề mặt da hút ẩm và mềm dần trong khi phần lõi vẫn giữ độ chắc. Sự thay đổi kết cấu giúp cún cảm nhận nhiều trạng thái nhai, duy trì sự tập trung lâu hơn.

Vận động cơ hàm và thỏa mãn nhu cầu nhai mạnh
Kết cấu dai buộc cún phối hợp răng cửa, răng nanh và răng hàm để giữ, kéo và nghiền. Quá trình này giúp cơ hàm vận động thường xuyên, phù hợp với những bé có lực nhai tốt.

Hỗ trợ chuyển hướng hành vi cắn phá
Thời gian gặm lâu tạo cho cún một hoạt động để tập trung, giúp giải tỏa buồn chán và chuyển sự chú ý khỏi giày dép, bàn ghế cùng đồ dùng trong nhà.

Cung cấp collagen và protein cấu trúc
Da bò cung cấp collagen giàu glycine và proline, bổ sung axit amin tham gia duy trì da và mô liên kết. `,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'xuong-no-da-bo-mini-vang', 
    name: 'Xương nơ da bò mini vàng', 
    weight: '60-70g', 
    price: '30.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm da bò', 
    img: '/c41.webp',
    specification:'4 xương/túi',
    ingredients: 'Da bò tự nhiên',
    description: `Thiết kế dạng xương nơ mini dễ tiếp cận với những dòng chó nhỏ
Khi cún cắn, kéo và xoay xương, bề mặt da cọ xát với thân răng, góp phần làm bong thức ăn thừa và hạn chế mảng bám mềm. Sản phẩm không loại bỏ cao răng đã hình thành và không thay thế việc chải răng.

Cấu trúc sợi collagen nén chặt giúp kéo dài thời gian gặm
Các sợi collagen trong da bò được ép sát, tạo kết cấu đặc và khó tách. Cún phải liên tục cắn, kéo và làm mềm từng lớp bằng nước bọt, nhờ đó thời gian gặm kéo dài hơn snack mềm.

Mềm dần khi nhai, duy trì sự hứng thú
Bề mặt da hút ẩm và mềm dần trong khi phần lõi vẫn giữ độ chắc. Sự thay đổi kết cấu giúp cún cảm nhận nhiều trạng thái nhai, duy trì sự tập trung lâu hơn.

Vận động cơ hàm và thỏa mãn nhu cầu nhai mạnh
Kết cấu dai buộc cún phối hợp răng cửa, răng nanh và răng hàm để giữ, kéo và nghiền. Quá trình này giúp cơ hàm vận động thường xuyên, phù hợp với những bé có lực nhai tốt.

Hỗ trợ chuyển hướng hành vi cắn phá
Thời gian gặm lâu tạo cho cún một hoạt động để tập trung, giúp giải tỏa buồn chán và chuyển sự chú ý khỏi giày dép, bàn ghế cùng đồ dùng trong nhà.

Cung cấp collagen và protein cấu trúc
Da bò cung cấp collagen giàu glycine và proline, bổ sung axit amin tham gia duy trì da và mô liên kết. `,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'que-da-heo', 
    name: 'Que da heo', 
    weight: '60g', 
    price: '32.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm da bò', 
    img: '/c14.webp',
    specification:'8 xương/túi',
    ingredients: 'Da heo tự nhiên',
    description: `Que da heo phù hợp hơn cho dòng chó nhỏ 
Que da heo sở hữu kết cấu dai nhẹ, kích thước vừa miệng, giúp cún dễ cầm, dễ ngoạm và thoải mái hơn trong mỗi lần nhai. So với da bò Rawhide thường dày và cứng, que da heo có kết cấu mỏng, mềm hơn, đặc biệt phù hợp với chó nhỏ hoặc những bé có lực hàm vừa phải.

Kết cấu dai nhẹ, dễ tiêu hóa hơn so với xương da bò lớn và cứng
Dáng que nhỏ gọn giúp cún dễ giữ bằng hai chân trước và chủ động hơn khi gặm. Độ dai vừa phải mang lại cảm giác nhai thú vị mà không khiến những chiếc hàm nhỏ phải mất quá nhiều sức.

Mùi vị tự nhiên thơm béo, giúp cún nhai lâu không chán
Hương vị thơm béo của da heo giúp duy trì sự thích thú và tăng cảm giác ngon miệng. Đây là lựa chọn dễ tiếp cận với những bé nhanh chán hoặc không yêu thích đồ gặm da bò quá dày và cứng.

Cung cấp protein và collagen tự nhiên
Que da heo cung cấp protein, góp phần duy trì cơ bắp và thể trạng khỏe khoắn. Collagen tự nhiên bổ sung các axit amin tham gia cấu tạo da, sụn và mô liên kết, giúp món gặm vừa ngon miệng vừa mang thêm giá trị dinh dưỡng.

Thỏa mãn nhu cầu gặm nhai, hỗ trợ giảm buồn chán
Gặm nhai là bản năng tự nhiên của chó. Que da heo giúp cún giải tỏa năng lượng, giảm cảm giác buồn chán và chuyển hướng sự chú ý khỏi giày dép, bàn ghế cùng các vật dụng trong nhà.

Tạo ma sát với bề mặt răng trong lúc nhai
Trong quá trình gặm, bề mặt que tiếp xúc và tạo ma sát với răng, góp phần làm bong thức ăn thừa và hạn chế sự tích tụ của mảng bám mềm. Sản phẩm hỗ trợ chăm sóc răng miệng nhưng không thay thế việc chải răng thường xuyên.
`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'que-da-bo', 
    name: 'Que da bò', 
    weight: '60g', 
    price: '32.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm da bò', 
    img: '/c14-1.webp',
    specification:'8 xương/túi',
    ingredients: 'Da bò tự nhiên',
    description: `Rawhide tự nhiên giữ trọn hương vị đặc trưng của da bò
Sản phẩm Rawhide tự nhiên được xử lý tối giản giúp giữ trọn mùi vị thật của da. Sản phẩm phù hợp với những chú chó có nhu cầu gặm cao, thường xuyên buồn chán hoặc hay cắn phá đồ đạc trong nhà.

Kết cấu xoắn tăng khả năng tiếp xúc với bề mặt răng giúp giảm cao răng và mảng bám hiệu quả
Thiết kế dạng xoắn tạo ra nhiều đường rãnh và góc tiếp xúc trong quá trình nhai. Khi cún gặm, bề mặt que tạo ma sát với răng, góp phần làm bong thức ăn thừa và hạn chế sự tích tụ của mảng bám mềm.

Độ dai vừa phải giúp cơ hàm được vận động thường xuyên
Hoạt động cắn, kéo và nghiền giúp cơ hàm của cún vận động trong suốt quá trình gặm. Kết cấu dai chắc phù hợp với những bé có lực nhai tốt và yêu thích các món gặm lâu.

Thỏa mãn bản năng nhai và hỗ trợ hạn chế cắn phá
Gặm nhai là nhu cầu tự nhiên của chó. Que da bò Rawhide tạo cho cún một vật được phép nhai, giúp chuyển hướng sự chú ý khỏi giày dép, bàn ghế và các vật dụng trong nhà.

Giúp cún thư giãn và giảm cảm giác buồn chán
Những chuyển động nhai lặp lại có thể giúp cún tập trung, giải phóng năng lượng và thư giãn khi ở trong không gian quen thuộc. Sản phẩm đặc biệt hữu ích trong những khoảng thời gian cún cần tự chơi dưới sự giám sát.

Hỗ trợ huấn luyện và tạo động lực cho hành vi tốt
Que da bò Rawhide có thể dùng làm phần thưởng giá trị cao sau khi cún hoàn thành khẩu lệnh, giữ bình tĩnh hoặc ngoan ngoãn trở về vị trí. Thưởng đúng thời điểm giúp cún liên kết hành vi tích cực với trải nghiệm nhai yêu thích.
`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'thit-xien-que-rau-cu-single-kaboz', 
    name: 'Thịt xiên que rau củ Single Kaboz', 
    weight: '100g', 
    price: '30.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm keo nhai', 
    img: '/c10.webp',
    specification:'20 xương/túi',
    ingredients: 'Tinh bột bắp, bột mì, bột gạo, bột đậu hà lan, glycerin, sorbitol, thịt gà, thịt heo, thịt vịt, khoai lang sấy khô, gelatin heo, chiết xuất nấm men, fructose, đường maltose, glycerol Monostearate, muối, carrageenan, carmine (E120), dicalcium phosphate, tetrasodium pyrophosphate, potassium sorbate, sodium propionate, sodium tripolyphosphate, màu caramel, vitamin E, vitamin B1, vitamin B6, màu sunset Yellow, vitamin B12, vitamin B2',
    description: `3 loại thịt gà, heo & vịt giàu protein, hỗ trợ cún khỏe mạnh
Sự kết hợp giữa thịt gà, thịt heo và thịt vịt cung cấp nguồn protein động vật cùng các axit amin thiết yếu, góp phần duy trì cơ bắp và thể trạng năng động. Ba loại thịt tạo nên hương vị đậm đà, hấp dẫn, giúp món thưởng phù hợp với cả những bé dễ chán các hương vị quen thuộc.

Đậu Hà Lan bổ sung protein thực vật, dễ tiêu hóa và hấp thu
Đậu Hà Lan bổ sung protein thực vật và chất xơ, góp phần cân bằng nguồn dinh dưỡng trong sản phẩm. Thành phần này còn giúp tạo kết cấu hài hòa, để thú cưng dễ dàng nhai và thưởng thức.

Khoai lang giàu chất xơ tự nhiên, hỗ trợ tiêu hóa khỏe mạnh
Khoai lang cung cấp chất xơ tự nhiên, hỗ trợ hoạt động của hệ tiêu hóa và duy trì đường ruột khỏe mạnh. Vị ngọt dịu tự nhiên của khoai lang còn giúp món thưởng trở nên thơm ngon và dễ ăn hơn.

Vitamin E cùng Vitamin B hỗ trợ sức khỏe và thể trạng toàn diện
Vitamin E có đặc tính chống oxy hóa, góp phần bảo vệ tế bào trước tác động của các gốc tự do. Vitamin nhóm B tham gia vào quá trình chuyển hóa dưỡng chất thành năng lượng, hỗ trợ cún duy trì thể trạng khỏe khoắn và năng động mỗi ngày.

Tetrasodium Pyrophosphate hỗ trợ chăm sóc răng, giảm hình thành cao răng
Tetrasodium Pyrophosphate hỗ trợ hạn chế khoáng chất tích tụ trên bề mặt răng, từ đó góp phần giảm sự hình thành cao răng. Kết hợp với hoạt động nhai, sản phẩm giúp cún vừa thỏa mãn nhu cầu nhai gặm vừa được hỗ trợ chăm sóc răng miệng hằng ngày.`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'thit-xien-que-rau-cu-double-kaboz', 
    name: 'Thịt xiên que rau củ Double Kaboz', 
    weight: '100g', 
    price: '35.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm keo nhai', 
    img: '/c10-1.webp',
    specification:'10 xương/túi',
    ingredients: 'Tinh bột bắp, bột mì, bột gạo, bột đậu hà lan, glycerin, sorbitol, thịt gà, thịt heo, thịt vịt, khoai lang sấy khô, gelatin heo, chiết xuất nấm men, fructose, đường maltose, glycerol Monostearate, muối, carrageenan, carmine (E120), dicalcium phosphate, tetrasodium pyrophosphate, potassium sorbate, sodium propionate, sodium tripolyphosphate, màu caramel, vitamin E, vitamin B1, vitamin B6, màu sunset Yellow, vitamin B12, vitamin B2',
    description: `Thịt gà tươi chọn lọc tạo nên hương vị đậm đà từ nguyên liệu thật
Thịt gà tươi là điểm nhấn của công thức, mang đến nguồn protein động vật chất lượng cùng hương vị tự nhiên mà nhiều chú chó yêu thích. 
Việc sử dụng thịt gà tươi không chỉ tăng sức hấp dẫn mà còn giúp mỗi que gặm giữ được vị thịt chân thực trong từng lần thưởng thức.

Cà rốt & Đậu Hà Lan giúp snack dễ ăn và dễ tiêu hóa
Thay vì chỉ tập trung vào nguồn đạm, sản phẩm kết hợp thêm cà rốt và đậu Hà Lan nhằm đa dạng thành phần dinh dưỡng. Cà rốt bổ sung
 beta-carotene tự nhiên, trong khi đậu Hà Lan mang đến chất xơ và protein thực vật, giúp công thức hài hòa hơn cả về hương vị lẫn giá trị dinh dưỡng.

Vi chất dinh dưỡng hỗ trợ da và lông mềm mượt 
Vitamin B12 góp phần chuyển hóa dưỡng chất thành năng lượng và hỗ trợ quá trình tạo hồng cầu. Vitamin E hoạt động như một chất chống oxy hóa, giúp bảo vệ tế bào, hỗ trợ miễn dịch và duy trì làn da khỏe cùng bộ lông bóng mượt cho cún.

Thiết kế Double Kabob - Gấp đôi sự thích thú trong mỗi lần gặm
Lấy cảm hứng từ xiên thịt đôi, Double Kabob mang đến trải nghiệm nhai mới lạ với hai thanh được kết hợp trong cùng một sản phẩm. 
Thiết kế này không chỉ tạo điểm nhấn về hình thức mà còn giúp tăng diện tích tiếp xúc khi nhai, mang lại cảm giác gặm thú vị và đáp ứng tốt hơn bản năng nhai tự nhiên của chó.`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'vong-gam-sach-rang-khoai-lang-3-vi', 
    name: 'Vòng gặm sạch răng khoai lang 3 vị', 
    weight: '100g', 
    price: '45.000đ',
    category: 'Bánh thưởng', 
    group: 'Nhóm keo nhai', 
    img: '/db02.webp',
    specification:'36 túi/thùng',
    ingredients: 'Thịt gà, Thịt bò, Thịt vịt, Tinh bột khoai mì, Bột khoai tây, Bột gạo, Sorbitol, Glycerin, Gelatin, Fructose, Đường IMO, Bột bắp, Vitamin E, Đạm đậu Hà Lan, Gluten lúa mì, Chiết xuất nấm men, Calcium Carbonate...',
    description: `Thiết kế dạng xương nơ mini dễ tiếp cận với những dòng chó nhỏ
Khi cún cắn, kéo và xoay xương, bề mặt da cọ xát với thân răng, góp phần làm bong thức ăn thừa và hạn chế mảng bám mềm. Sản phẩm không loại bỏ cao răng đã hình thành và không thay thế việc chải răng.

Cấu trúc sợi collagen nén chặt giúp kéo dài thời gian gặm
Các sợi collagen trong da bò được ép sát, tạo kết cấu đặc và khó tách. Cún phải liên tục cắn, kéo và làm mềm từng lớp bằng nước bọt, nhờ đó thời gian gặm kéo dài hơn snack mềm.

Mềm dần khi nhai, duy trì sự hứng thú
Bề mặt da hút ẩm và mềm dần trong khi phần lõi vẫn giữ độ chắc. Sự thay đổi kết cấu giúp cún cảm nhận nhiều trạng thái nhai, duy trì sự tập trung lâu hơn.

Vận động cơ hàm và thỏa mãn nhu cầu nhai mạnh
Kết cấu dai buộc cún phối hợp răng cửa, răng nanh và răng hàm để giữ, kéo và nghiền. Quá trình này giúp cơ hàm vận động thường xuyên, phù hợp với những bé có lực nhai tốt.

Hỗ trợ chuyển hướng hành vi cắn phá
Thời gian gặm lâu tạo cho cún một hoạt động để tập trung, giúp giải tỏa buồn chán và chuyển sự chú ý khỏi giày dép, bàn ghế cùng đồ dùng trong nhà.

Cung cấp collagen và protein cấu trúc
Da bò cung cấp collagen giàu glycine và proline, bổ sung axit amin tham gia duy trì da và mô liên kết. `,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'xuong-nhai-vi-ga-mix-rau-cu-3-mau', 
    name: 'Xương nhai vị gà mix rau củ 3 màu', 
    weight: '175g', 
    price: '45.000đ',
    category: 'Bánh thưởng', 
    group: 'Nhóm keo nhai', 
    img: '/db05.webp',
    specification:'36 túi/thùng',
    ingredients: 'Tinh bột khoai lang, Bột khoai lang, Bột đậu nành, Glycerin, Ức gà, Gelatin, Calcium Carbornate, Đạm đậu hà lan, Sorbitol, Fructose, Distilled Monoglyceride, Dầu thực vật, Bột cà chua, Gluten lúa mì, Carrageenan, Đường IMO, Tetrasodium, Pyrophosphate, Sordium Tripolyphosphate, Muối, Bột rau cau chân vịt, Hương thịt gà, Chiết xuất hương thảo, Vitamin E, Carmine(E120)',
    description: `Ức gà giàu protein, tiếp thêm năng lượng cho bé cún
Ức gà là nguồn protein dễ hấp thu, cung cấp các axit amin thiết yếu giúp hỗ trợ phát triển cơ bắp, phục hồi mô và đáp ứng nhu cầu vận động hằng ngày của bé.

Khoai lang giàu chất xơ, hỗ trợ hệ tiêu hóa khỏe mạnh
Tinh bột khoai lang và bột khoai lang bổ sung nguồn chất xơ tự nhiên, góp phần hỗ trợ hệ tiêu hóa hoạt động ổn định và giúp bé cún hấp thu dinh dưỡng hiệu quả hơn.

Rau củ 3 màu bổ sung dưỡng chất từ thiên nhiên
Bột cà chua và bột rau chân vịt bổ sung các vitamin, khoáng chất và chất chống oxy hóa tự nhiên, góp phần nuôi dưỡng sức khỏe tổng thể và tăng thêm giá trị dinh dưỡng cho món thưởng.

Đạm đậu Hà Lan bổ sung protein thực vật, dễ tiêu hóa
Đạm đậu Hà Lan cung cấp nguồn protein thực vật chất lượng, giúp cân bằng dinh dưỡng và hỗ trợ hệ tiêu hóa của bé cún hoạt động hiệu quả.

Đường IMO hỗ trợ cân bằng hệ vi sinh đường ruột
Đường IMO có đặc tính prebiotic, góp phần nuôi dưỡng lợi khuẩn đường ruột và hỗ trợ hệ tiêu hóa khỏe mạnh, giúp bé cún hấp thu dưỡng chất tốt hơn.

Canxi hỗ trợ xương chắc khỏe, Tetrasodium Pyrophosphate hỗ trợ giảm cao răng
Calcium Carbonate bổ sung canxi giúp duy trì hệ xương và răng chắc khỏe. Kết hợp cùng Tetrasodium Pyrophosphate, sản phẩm góp phần hạn chế hình thành mảng bám và cao răng trong quá trình nhai.

Vitamin E góp phần bảo vệ sức khỏe mỗi ngày
Vitamin E là chất chống oxy hóa giúp bảo vệ tế bào trước tác động của gốc tự do, góp phần duy trì thể trạng khỏe mạnh cho bé cún.`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'suon-thom-vi-ga-bo', 
    name: 'Sườn thơm vị gà & bò', 
    weight: '120g', 
    price: '50.000đ',
    category: 'Bánh thưởng', 
    group: 'Nhóm keo nhai', 
    img: '/db04.webp',
    specification:'36 túi/thùng',
    ingredients: 'Thịt gà, thịt bò, Glycerin, Sorbitol, Tinh bột khoai tây, Bột gạo, Đậu Hà Lan, Chiết xuất nấm men, Calcium Carbonate,Gelatin, Màu caramel, Hương khói tự nhiên, Hương thịt heo, Vitamin E, Đường, Muối',
    description: `Protein động vật từ thịt gà và thịt bò chất lượng cao
Thịt gà thơm ngọt kết hợp cùng thịt bò đậm đà, cung cấp nguồn protein động vật đa dạng, góp phần duy trì khối cơ và thể trạng năng động cho cún trong các hoạt động hằng ngày.

Hương thịt nướng hấp dẫn, kích thích vị giác
Hương khói tự nhiên hòa quyện cùng chiết xuất nấm men tạo nên mùi thơm nướng đặc trưng, giúp từng miếng bánh thưởng hình sườn thêm tròn vị và cuốn hút cún ngay khi mở gói.

Kết cấu mềm dai, dễ nhai và dễ thưởng
Glycerin, sorbitol và gelatin giúp duy trì độ ẩm, tạo kết cấu mềm dai vừa phải, để cún dễ nhai và thưởng thức ngon miệng hơn. Hình dáng sườn bắt mắt còn mang lại trải nghiệm nhai gặm thú vị.

Carbohydrate bổ sung năng lượng vận động và huấn luyện
Tinh bột khoai tây, bột gạo và đậu Hà Lan cung cấp carbohydrate, góp phần bổ sung năng lượng cho cún vui chơi, vận động và tham gia các buổi huấn luyện.

Bổ sung vitamin E và canxi chắc khỏe xương, cho da lông khỏe mạnh 
Vitamin E hoạt động như một chất chống oxy hóa, góp phần bảo vệ tế bào trước tác động của các gốc tự do. Calcium carbonate bổ sung canxi cho công thức, hỗ trợ duy trì cấu trúc xương và răng.
Với hình dáng sườn độc đáo, hương thịt nướng cuốn hút và kết cấu mềm dai, sản phẩm thích hợp làm món thưởng hằng ngày hoặc phần thưởng tạo động lực trong quá trình huấn luyện.`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại'
  },
  { 
    slug: 'uc-ga-say-dinh-duong-cho-cho', 
    name: 'Ức gà sấy dinh dưỡng cho chó', 
    weight: '90g', 
    price: '57.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm thịt sấy', 
    img: '/db03.webp',
    specification:'36 túi/thùng',
    ingredients: 'Thịt gà, Glycerin thực vật, muối',
    description: `Nguồn protein ít chất béo từ thịt gà giúp duy trì cơ bắp, tái tạo mô, nuôi dưỡng da và lông
Ức gà sấy cho chó được làm từ thịt gà thật, cung cấp nguồn protein động vật chất lượng cao cùng các axit amin thiết yếu giúp duy trì khối cơ săn chắc, hỗ trợ tái tạo mô sau các hoạt động hằng ngày, đồng thời góp phần nuôi dưỡng làn da khỏe mạnh và bộ lông mềm mượt. 

Không chất tạo màu, không chất bảo quản, không dùng các loại chất độn công nghiệp giá rẻ
Sản phẩm được phát triển theo công thức tối giản chỉ với 3 thành phần, tập trung vào hương vị tự nhiên từ thịt gà. Không sử dụng chất tạo màu, không bổ sung chất điều vị, không dùng các loại chất độn công nghiệp giá rẻ, giúp người nuôi yên tâm hơn khi lựa chọn snack cho chó sử dụng hằng ngày.

Kết cấu mềm ẩm, dai nhẹ giúp tiêu hóa tốt hơn
Ức gà sấy sở hữu kết cấu mềm ẩm kết hợp độ dai vừa phải, giúp cún dễ nhai hơn so với nhiều loại thịt sấy cứng. Cấu trúc này còn kéo dài thời gian nhai, mang lại trải nghiệm thưởng thức hấp dẫn và phù hợp với nhiều giống chó ở các kích cỡ khác nhau.

Hương vị thịt gà tự nhiên kích thích vị giác, phù hợp huấn luyện
Mùi thơm đặc trưng cùng vị ngọt tự nhiên từ thịt gà thật giúp kích thích khứu giác và vị giác của cún ngay khi mở gói. Đây là bánh thưởng cho chó lý tưởng để khen thưởng khi huấn luyện, tương tác hằng ngày hoặc đơn giản là dành cho bé một món ăn vặt thơm ngon giữa các bữa ăn.`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại.'
  },
  { 
    slug: 'uc-ga-say-dinh-duong-cho-meo', 
    name: 'Ức gà sấy dinh dưỡng cho mèo', 
    weight: '90g', 
    price: '57.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm thịt sấy', 
    img: '/db06.webp',
    specification:'36 túi/thùng',
    ingredients: 'Thịt gà, Glycerin thực vật, muối',
    description: `Nguồn protein ít chất béo từ thịt gà giúp duy trì cơ bắp, tái tạo mô, nuôi dưỡng da và lông
Ức gà sấy cho chó được làm từ thịt gà thật, cung cấp nguồn protein động vật chất lượng cao cùng các axit amin thiết yếu giúp duy trì khối cơ săn chắc, hỗ trợ tái tạo mô sau các hoạt động hằng ngày, đồng thời góp phần nuôi dưỡng làn da khỏe mạnh và bộ lông mềm mượt. 

Không chất tạo màu, không chất bảo quản, không dùng các loại chất độn công nghiệp giá rẻ
Sản phẩm được phát triển theo công thức tối giản chỉ với 3 thành phần, tập trung vào hương vị tự nhiên từ thịt gà. Không sử dụng chất tạo màu, không bổ sung chất điều vị, không dùng các loại chất độn công nghiệp giá rẻ, giúp người nuôi yên tâm hơn khi lựa chọn snack cho chó sử dụng hằng ngày.

Kết cấu mềm ẩm, dai nhẹ giúp tiêu hóa tốt hơn
Ức gà sấy sở hữu kết cấu mềm ẩm kết hợp độ dai vừa phải, giúp cún dễ nhai hơn so với nhiều loại thịt sấy cứng. Cấu trúc này còn kéo dài thời gian nhai, mang lại trải nghiệm thưởng thức hấp dẫn và phù hợp với nhiều giống chó ở các kích cỡ khác nhau.

Hương vị thịt gà tự nhiên kích thích vị giác, phù hợp huấn luyện
Mùi thơm đặc trưng cùng vị ngọt tự nhiên từ thịt gà thật giúp kích thích khứu giác và vị giác của cún ngay khi mở gói. Đây là bánh thưởng cho chó lý tưởng để khen thưởng khi huấn luyện, tương tác hằng ngày hoặc đơn giản là dành cho bé một món ăn vặt thơm ngon giữa các bữa ăn. `,
    target: 'Phù hợp cho mọi giống mèo, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại.'
  },
  { 
    slug: 'que-gam-sach-rang-munchy', 
    name: 'Que gặm sạch răng Munchy', 
    weight: '100g', 
    price: '29.000đ',
    category: 'Xương gặm', 
    group: 'Nhóm que gặm tổng hợp', 
    img: '/c28.webp',
    specification:'15 xương/túi',
    ingredients: 'Da bò, da heo, bột gạo, bột mì, dầu đậu nành, đường, hương gà, hương bò, carmine (120), màu caramel',
    description: `Xương gặm sạch răng Munchy giòn vừa, dễ nhai và hỗ trợ giảm mảng bám
Xương Munchy được tạo nên từ da bò và da heo xay nhuyễn, phối trộn cùng bột bắp rồi định hình thành những que gặm đồng đều. Kết cấu giòn vừa, dễ cắn và dễ nghiền hơn Rawhide nguyên miếng, phù hợp với chó nhỏ hoặc những bé có lực hàm vừa.

Kết cấu da bò và da heo xay nhuyễn giúp dễ tiêu hóa hơn so với dòng da nguyên miếng  
Mỗi lần cún cắn và nghiền, bề mặt xương tạo ma sát nhẹ với răng, góp phần làm bong thức ăn thừa và hạn chế sự tích tụ của mảng bám mềm. Nhờ đó, cún vừa được tận hưởng niềm vui gặm nhai, vừa được hỗ trợ chăm sóc răng miệng theo cách tự nhiên.

Protein và collagen góp phần duy trì thể trạng
Da bò và da heo cung cấp protein cùng collagen tự nhiên, bổ sung các axit amin tham gia duy trì cơ bắp, làn da và cấu trúc mô liên kết. Một món thưởng nhỏ nhưng mang thêm giá trị bên cạnh trải nghiệm nhai thú vị.

Thỏa mãn bản năng nhai, xua tan cảm giác buồn chán
Hoạt động nhai giúp cơ hàm được vận động, đồng thời mang đến cho cún một khoảng thời gian tập trung và thư giãn. Xương Munchy còn giúp chuyển hướng sự chú ý khỏi giày dép, bàn ghế và những vật dụng không nên cắn trong nhà.

Ba màu đa dạng, mỗi lần thưởng thêm phần mới mẻ
Xương Munchy có ba màu gồm trắng nguyên bản, nâu caramel và đỏ carmine E120. Sự đa dạng về hình thức giúp túi snack thêm sinh động, để sen linh hoạt thay đổi trong mỗi lần thưởng cún ngoan hoặc hỗ trợ huấn luyện`,
    target: 'Phù hợp cho mọi giống chó, sử dụng như snack nhai bổ sung hằng ngày hoặc làm món thưởng giữa các bữa ăn',
    preservation: 'Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và ẩm. Sau khi mở bao, đóng kín túi hoặc để trong hộp kín. Không dùng cho động vật nhai lại.'
  },
  { 
    slug: 'cat-dat-set-bentonite-zen-cat', 
    name: 'Cát đất sét Bentonite Zen Cat', 
    weight: '4kg/túi', 
    price: '60.000đ',
    category: 'Cát vệ sinh', 
    group: '', 
    img: '/zc.webp',
    specification:'4 túi/tải',
    ingredients: '',
    description: '',
    target: 'Phù hợp cho mọi giống mèo, cát vệ sinh sử dụng hằng ngày',
    preservation: ''
  },
  { 
    slug: 'ta-lot-chuong-thuong', 
    name: 'Tã lót chuồng thường', 
    weight: '1.2kg', 
    price: '103.000đ',
    category: 'Tã cho thú cưng', 
    group: '', 
    img: '/tl.webp',
    specification: 'Đóng gói dạng túi',
    sizes: [
      { size: 'S', quantity: '100 miếng' },
      { size: 'M', quantity: '50 miếng' },
      { size: 'L', quantity: '40 miếng' },
      { size: 'XL', quantity: '20 miếng' }
    ],
    ingredients: '',
    description: '',
    target: 'Phù hợp cho mọi giống chó, sử dụng hằng ngày',
    preservation: ''
  },
  { 
    slug: 'ta-lot-chuong-than-hoat-tinh', 
    name: 'Tã lót chuồng than hoạt tính',
    weight: '1.4kg', 
    price: '128.000đ',
    category: 'Tã cho thú cưng', 
    group: '', 
    img: '/tlt.webp',
    specification: 'Đóng gói dạng túi',
    sizes: [
      { size: 'S', quantity: '100 miếng' },
      { size: 'M', quantity: '50 miếng' },
      { size: 'L', quantity: '40 miếng' },
      { size: 'XL', quantity: '20 miếng' }
    ],
    ingredients: '',
    description: '',
    target: 'Phù hợp cho mọi giống chó, sử dụng hằng ngày',
    preservation: ''
  }
];

function parsePrice(priceStr) {
  if (!priceStr) return 0;
  return parseInt(String(priceStr).replace(/[^\d]/g, ''), 10);
}

// Hàm upload file ảnh sử dụng uploadFiles chuẩn SDK mới
async function uploadImageToDirectus(imagePathRelative) {
  if (!imagePathRelative) return null;
  
  const cleanPath = imagePathRelative.startsWith('/') ? imagePathRelative.slice(1) : imagePathRelative;
  const localFilePath = path.join(process.cwd(), 'public', cleanPath);
  
  if (!fs.existsSync(localFilePath)) {
    console.warn(`⚠️ Không tìm thấy file ảnh tại: ${localFilePath}`);
    return null;
  }

  try {
    const fileBuffer = fs.readFileSync(localFilePath);
    const blob = new Blob([fileBuffer]);
    const form = new FormData();
    form.append('file', blob, path.basename(cleanPath));

    // Dùng uploadFiles thay cho uploadFile
    const result = await client.request(uploadFiles(form));
    
    // SDK mới có thể trả về 1 object hoặc 1 mảng các file vừa upload
    const uploadedFile = Array.isArray(result) ? result[0] : result;
    return uploadedFile ? uploadedFile.id : null;
  } catch (error) {
    console.error(`❌ Lỗi upload ảnh ${imagePathRelative}:`, error.message);
    return null;
  }
}

async function getOrCreateRelation(collectionName, nameValue) {
  if (!nameValue) return null;
  
  const existing = await client.request(
    readItems(collectionName, {
      filter: { name: { _eq: nameValue } }
    })
  );

  if (existing.length > 0) return existing[0].id;

  const created = await client.request(
    createItem(collectionName, {
      name: nameValue,
      slug: nameValue.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-')
    })
  );

  return created.id;
}

async function seedData() {
  if (allProducts.length === 0) {
    console.error('❌ Mảng allProducts đang rỗng! Hãy dán mảng dữ liệu vào file.');
    return;
  }

  console.log('🚀 Bắt đầu upload ảnh và import sản phẩm vào Directus...');

  for (const item of allProducts) {
    try {
      const categoryId = await getOrCreateRelation('categories', item.category);
      const groupId = await getOrCreateRelation('product_groups', item.group);
      
      const imageList = item.images || (item.img ? [item.img] : []);
      const uploadedImageRelations = [];

      for (const imgPath of imageList) {
        const fileId = await uploadImageToDirectus(imgPath);
        if (fileId) {
          uploadedImageRelations.push({
            directus_files_id: { id: fileId }
          });
        }
      }

      const productPayload = {
        slug: item.slug,
        name: item.name,
        weight: item.weight || '',
        price: parsePrice(item.price),
        specification: item.specification || '',
        ingredients: item.ingredients || '',
        description: item.description || '',
        target: item.target || '',
        preservation: item.preservation || '',
        images: uploadedImageRelations,
        category: categoryId,
        group: groupId,
        status: 'published'
      };

      const result = await client.request(createItem('products', productPayload));
      console.log(`✅ Đã thêm: ${result.name} (${uploadedImageRelations.length} ảnh)`);
    } catch (error) {
      console.error(`❌ Lỗi sản phẩm "${item.name}":`, error.message);
    }
  }

  console.log('🎉 Hoàn tất toàn bộ!');
}

seedData();