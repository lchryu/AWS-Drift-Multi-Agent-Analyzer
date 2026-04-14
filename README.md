# Reflection Report

**Unit code:** COS40006  
**Unit Name:** Computing Technology Project B  
**Submission date:** 14/04/2026

---

## 1. EXECUTIVE SUMMARY (TÓM TẮT DỰ ÁN)
Dự án Drift Analyzer tập trung vào việc giải quyết bài toán **Drift** — sự sai lệch giữa cấu hình hạ tầng trong các bản thiết kế (thường là các template CloudFormation lưu tại local) và trạng thái thực tế của các tài nguyên đang chạy trên nền tảng **AWS**. Mục tiêu cốt lõi của dự án là xây dựng một **VS Code Extension** tích hợp hệ thống **Multi-Agent** thông minh để giúp lập trình viên và quản trị viên hệ thống phát hiện, phân tích và tự động đồng bộ hạ tầng. 

Hệ thống cung cấp 3 chế độ vận hành chính: 
1. **Ask mode**: Giúp nhanh chóng truy vấn thông tin và trạng thái hiện tại của tài nguyên. 
2. **Classification mode**: Tự động phân loại mức độ nghiêm trọng của sai lệch và xác định nguyên nhân gốc rễ. 
3. **Agent mode**: Chế độ tự động hoàn toàn, nơi các Agent phối hợp để lập kế hoạch sửa lỗi, thực thi và kiểm chứng kết quả. 

Trong dự án này, tôi đảm nhận vai trò chủ chốt trong việc kiểm thử (Testing), khắc phục các lỗi vận hành (Debugging) và xây dựng bộ tài liệu thuyết minh kỹ thuật cho toàn bộ hệ thống.

## 2. REFLECTION ON INDIVIDUAL ACHIEVEMENTS (PHẢN HỒI VỀ THÀNH TỰU CÁ NHÂN)
Thành tựu lớn nhất của tôi là đảm bảo được tính chính xác và tin cậy của quy trình phát hiện sai lệch hạ tầng thông qua kiểm thử thực tế.
- **Xây dựng quy trình xác thực hạ tầng**: Tôi đã nắm vững cách thức phát hiện "Drift" bằng cách so sánh trực tiếp cấu hình kỳ vọng trong template local với trạng thái tài nguyên trên AWS.
- **Hoàn thiện tài liệu thuật ngữ và vận hành**: Tôi đã hệ thống hóa các khái niệm kỹ thuật phức tạp thành các tài liệu dễ hiểu (`project_overview.md`) và xây dựng kịch bản demo (`thuyet_minh.md`), giúp làm rõ vai trò của từng chế độ Ask, Classification và Agent đối với người dùng cuối.
- **Kiểm định sự thông minh của AI**: Tôi đã thành công trong việc thiết lập các bài testcase để "bắt lỗi" AI, giúp tối ưu hóa khả năng phản hồi của các Agent Researcher và Executor.

## 3. REFLECTION ON INDIVIDUAL CHALLENGES (PHẢN HỒI VỀ THÁCH THỨC CÁ NHÂN)
Tôi đã phải vượt qua nhiều rào cản kỹ thuật để đảm bảo hệ thống vận hành trơn tru:
- **Lỗi xác thực và khớp nối API**: Một trong những thách thức lớn là lỗi `InvalidClientTokenId`. Đây là lỗi nảy sinh khi extension cố gắng kết nối với AWS nhưng thông tin cấu hình local không khớp hoặc hết hạn. Tôi đã phải nghiên cứu sâu về cơ chế xác thực của AWS SDK để tìm ra phương án xử lý lỗi này triệt để.
- **Vấn đề AI ảo giác (Hallucination)**: Trong quá trình test, AI thỉnh thoảng đề xuất dựa trên các thông số cấu hình không có thực. Để giải quyết, tôi đã phối hợp để tích hợp công cụ **SearXNG** chạy local, giúp Agent có thể tra cứu tài liệu AWS chính xác trước khi so sánh với cấu hình local.
- **Tối ưu hóa UI cho các thông tin phức tạp**: Việc hiển thị các bảng so sánh sai lệch tài nguyên đòi hỏi sự tỉ mỉ trong việc thiết kế webview để người dùng có thể nhận diện lỗi ngay lập tức.

## 4. REFLECTION ON INDIVIDUAL CONTRIBUTION (PHẢN HỒI VỀ ĐÓNG GÓP CÁ NHÂN)
Tôi đóng vai trò là "người gác cổng" về chất lượng (QA) và là "người truyền đạt" (Thuyết minh) cho dự án:
- **Chuyên gia Debugging & Testing**: Tôi trực tiếp thực hiện việc giả lập sai lệch hạ tầng (như thay đổi Tag, Name hay Security Groups thủ công trên AWS console) để kiểm tra xem Extension có phát hiện đúng so với cấu hình local hay không. Tôi đã fix nhiều lỗi liên quan đến việc xử lý dữ liệu từ AWS trả về.
- **Xây dựng kịch bản Thuyết minh (Presentation)**: Tôi chịu trách nhiệm viết kịch bản hướng dẫn người dùng qua 3 chế độ Ask, Classification và Agent. Tôi đảm bảo rằng các tính năng phức tạp của Multi-Agent được giải thích một cách súc tích và mạch lạc.
- **Quản lý dữ liệu người dùng**: Tôi đã kiểm thử hệ thống quản lý hội thoại (Conversation Management) sử dụng SQLite, đảm bảo việc lưu trữ và truy xuất lịch sử chat giữa người dùng và Agent luôn chính xác và an toàn.

## 5. REFLECTION ON INDIVIDUAL SKILL DEVELOPMENT (PHẢN HỒI VỀ PHÁT TRIỂN KỸ NĂNG)
- **Kỹ năng chuyên môn**: Nâng cao kỹ năng kiểm thử hệ thống Cloud (AWS), hiểu biết sâu về Infrastructure as Code (IaC) và cách tối ưu hóa LLM Agents thông qua SearXNG.
- **Kỹ năng Technical Writing**: Phát triển khả năng viết tài liệu kỹ thuật chuyên nghiệp, biến các quy trình AI Agent phức tạp thành các hướng dẫn vận hành đơn giản.
- **Kỹ năng giải quyết vấn đề**: Khả năng bình tĩnh phân tích log hệ thống để tìm ra nguyên nhân gốc rễ của các lỗi kết nối Cloud API.

## 6. TAKE AWAY (BÀI HỌC KINH NGHIỆM)
Bài học lớn nhất tôi rút ra được là: "Hiểu đúng về sự khác biệt giữa cấu hình local và hạ tầng thực tế là chìa khóa để vận hành Cloud an toàn". AI là một trợ thủ đắc lực nhưng nó cần được kiểm chứng (Verify) một cách nghiêm ngặt. Nếu có cơ hội thực hiện lại, tôi sẽ phát triển thêm các bộ testcase tự động (Automation Test) để kiểm tra độ tin cậy của Agent trong nhiều tình huống hạ tầng khác nhau. Dự án này đã giúp tôi hình dung rõ nét hơn về tương lai của ngành hạ tầng số khi có sự trợ giúp của AI.
