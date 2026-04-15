# Reflection Report

**Unit code:** COS40006  
**Unit Name:** Computing Technology Project B  
**Submission date:** 14/04/2026

---

## 1. EXECUTIVE SUMMARY (TÓM TẮT DỰ ÁN)
Dự án tập trung vào việc phát hiện và xử lý sự sai lệch (**Drift**) giữa cấu hình hạ tầng cục bộ (local templates) và trạng thái thực tế trên nền tảng **AWS**. Mục tiêu chính là xây dựng một **VS Code Extension** tích hợp hệ thống **Multi-Agent** thông minh, hỗ trợ quản trị viên thông qua 3 chế độ hoạt động: **Ask** (Truy vấn), **Classification** (Phân tích mức độ lỗi) và **Agent** (Sửa lỗi tự động). 

Trong dự án này, vai trò cá nhân của tôi tập trung vào việc **kiểm thử hệ thống (testing), bóc tách và khắc phục lỗi (debugging), trực tiếp xây dựng kịch bản và quay video demo sản phẩm, cũng như soạn thảo các tài liệu thuyết minh và báo cáo kỹ thuật**. Báo cáo này trình bày hành trình cá nhân của tôi trong việc đảm bảo chất lượng và khả năng vận hành thực tế của dự án.

## 2. REFLECTION ON INDIVIDUAL ACHIEVEMENTS (PHẢN HỒI VỀ THÀNH TỰU CÁ NHÂN)
Thành tựu lớn nhất của tôi là khả năng thích nghi nhanh chóng với những công nghệ hoàn toàn mới để đóng góp giá trị cho sản phẩm.
- **Làm chủ quy trình xác thực hạ tầng Cloud**: Dù ban đầu còn nhiều bỡ ngỡ với AWS, tôi đã thành thạo việc sử dụng các công cụ hiện đại để phát hiện "Drift" và hiểu rõ cơ chế vận hành của CloudFormation.
- **Đóng góp vào thiết kế hệ thống**: Tôi đã tích cực tham gia vào các buổi lập kế hoạch (Planning), thảo luận để chốt ý tưởng về 3 chế độ vận hành (**Ask, Classification, Agent**), giúp hệ thống đi đúng hướng và giải quyết được bài toán thực tế của người dùng.
- **Tối ưu hóa nhờ công nghệ tiên phong**: Việc ứng dụng các công nghệ AI Agents mới nhất đã giúp tôi rút ngắn khoảng cách về kiến thức, cho phép tôi tìm hiểu và tham gia trực tiếp vào việc phát triển hệ thống nhanh hơn mong đợi.

## 3. REFLECTION ON INDIVIDUAL CHALLENGES (PHẢN HỒI VỀ THÁCH THỨC CÁ NHÂN)
Hành trình thực hiện dự án mang lại cho tôi những thách thức không nhỏ về mặt kỹ thuật:
- **Rào cản về nền tảng Web và AWS**: Do không có nền tảng chuyên sâu về lập trình Web và Cloud (AWS), việc tiếp cận một dự án phức tạp như Drift Analyzer là một áp lực lớn. Tôi đã phải dành rất nhiều thời gian để làm quen với các dịch vụ AWS SDK và cấu trúc của một VS Code Extension.
- **Đường cong học tập dốc (Learning Curve)**: Mặc dù các công cụ hỗ trợ AI mới nhất giúp tôi bắt nhịp nhanh hơn, nhưng việc hiểu sâu về logic AgentCore và cơ chế quản lý trạng thái hạ tầng vẫn là một thử thách khó khăn. Có những lúc việc fix lỗi xác thực (`InvalidClientTokenId`) hay cấu hình SearXNG khiến tôi mất nhiều ngày nghiên cứu.
- **Sự phối hợp trong môi trường mới**: Việc vừa học công nghệ mới vừa phải đảm bảo các mốc thời gian (milestones) của nhóm đòi hỏi khả năng quản lý thời gian và tinh thần tự học cực cao.

## 4. REFLECTION ON INDIVIDUAL CONTRIBUTION (PHẢN HỒI VỀ ĐÓNG GÓP CÁ NHÂN)
Tôi đóng vai trò là "người gác cổng" cuối cùng, đảm bảo sản phẩm không chỉ chạy được mà còn phải chạy đúng trong thực tế:

- **Kết nối AI Chat Webview với API thông qua Extension Backend**: Đây là đóng góp kỹ thuật quan trọng của tôi trong việc thiết lập cơ chế giao tiếp hai chiều giữa người dùng và AI, đảm bảo luồng dữ liệu truyền tải ổn định.
- **Kiểm thử thực tế và Báo cáo lỗi (Manual Testing & Bug Reporting)**: Đây là đóng góp thực tiễn nhất của tôi. Tôi đã trực tiếp giả lập hàng loạt kịch bản lỗi hạ tầng trên AWS (Manual trigger drift) để bóc tách các lỗi logic của Agent. Mọi lỗi liên quan đến Tool Calling hay phản hồi sai của AI đều được tôi ghi nhận và phối hợp xử lý triệt để.
- **Xây dựng kịch bản và Quay Video Demo (Thuyết minh sản phẩm)**: Tôi là người trực tiếp xây dựng kịch bản và thực hiện các video demo để chứng minh năng lực của hệ thống. Tôi đảm bảo rằng các tính năng phức tạp của Multi-Agent được trình diễn một cách dễ hiểu và thuyết phục nhất đến hội đồng và người dùng.
- **Quản lý dữ liệu**: Tôi chịu trách nhiệm kiểm thử hệ thống quản lý hội thoại sử dụng SQLite, đảm bảo việc lưu trữ lịch sử chat luôn chính xác và không xảy ra xung đột dữ liệu.

## 5. REFLECTION ON INDIVIDUAL SKILL DEVELOPMENT (PHẢN HỒI VỀ PHÁT TRIỂN KỸ NĂNG)
- **Kỹ năng chuyên môn**: Nâng cao kỹ năng Debugging, Technical Writing và sử dụng các công nghệ AI thế hệ mới để giải quyết bài toán hạ tầng Cloud.
- **Kỹ năng mềm**: Phát triển tư duy làm việc nhóm, kỹ năng thảo luận/phản biện để tìm ra giải pháp tối ưu và khả năng thích nghi nhanh trước sự thay đổi của công nghệ.

## 6. TAKE AWAY (BÀI HỌC KINH NGHIỆM)
Bài học lớn nhất tôi rút ra được là: "Sự ổn định của hệ thống quan trọng hơn tính năng hào nhoáng". Qua quá trình trực tiếp kiểm thử thủ công và quay video demo, tôi nhận ra rằng AI dù thông minh đến đâu vẫn cần một quy trình kiểm định cực kỳ nghiêm ngặt.

Nếu có cơ hội thực hiện lại dự án từ đầu, tôi sẽ thay đổi hướng tiếp cận như sau:
- **Chuyển dịch từ Kiểm thử thủ công sang Tự động (Automation First)**: Từ trải nghiệm thực tế khi phải dành rất nhiều thời gian để test tay và giả lập drift, tôi nhận ra tầm quan trọng của việc xây dựng một **Automated Testing Framework** ngay từ ngày đầu tiên để giải phóng sức lao động và tăng độ chính xác.
- **Đặt nặng tính Security-by-Design**: Thay vì đợi lỗi xảy ra mới fix, tôi sẽ đề xuất nhóm đặt bảo mật IAM làm trọng tâm ngay từ khi viết template CloudFormation local.
- **Tối ưu kịch bản tương tác (User-Centric Demos)**: Thay vì quay demo ở giai đoạn cuối, tôi sẽ dùng phương pháp demo-driven để định hình tính năng, giúp các Agent phản hồi sát với nhu cầu thực tế của người dùng hơn.

Dự án này giúp tôi hiểu rằng, vai trò của người kiểm soát và thuyết minh sản phẩm chính là "linh hồn" giúp đưa những dòng code kỹ thuật khô khan trở thành một giải pháp thực tế có giá trị.
