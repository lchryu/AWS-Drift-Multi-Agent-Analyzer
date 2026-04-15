# Reflection Report

**Unit Code:** COS40006  
**Unit Name:** Computing Technology Project B  
**Submission Date:** 14/04/2026

---

## 1. EXECUTIVE SUMMARY
This project focuses on detecting and fixing **Drift**—the difference between local infrastructure settings and the actual state on **AWS**. Our goal was to build a **VS Code Extension** powered by a **Multi-Agent** AI system. It helps users through three main features: **Ask** (Queries), **Classification** (Error analysis), and **Agent** (Automatic fixes).

In this project, my role was focused on **testing the system, finding and fixing bugs, creating demo videos, and writing technical reports**. This report describes my journey in ensuring the project works correctly and is easy for users to understand.

## 2. REFLECTION ON INDIVIDUAL ACHIEVEMENTS
My biggest achievement was quickly learning new technologies to contribute to the team.
- **Mastering Cloud Tools**: even though I was new to AWS, I learned how to use industrial tools to detect "Drift" and understood how infrastructure works in the cloud.
- **System Design Contribution**: I actively participated in planning sessions to define how the **Ask, Classification, and Agent** modes should work, ensuring the tool actually solves real user problems.
- **Efficiency through AI & Deep Research**: Using the latest AI tools and performing deep dives into technical documentation helped me learn much faster than expected. I served as a "knowledge bridge" for the team, summarizing complex AWS and VS Code concepts into actionable tasks.
- **Collaborative Planning**: I was a key participant in our weekly Sprint planning and design sessions. By providing regular feedback on the system's usability, I helped the team refine the AI's behavior to better match user expectations.

## 3. REFLECTION ON INDIVIDUAL CHALLENGES
This project came with several personal and technical hurdles:
- **Learning Curve for Web and Cloud**: Since I didn't have a background in Web or AWS programming, starting a complex project like "Drift Analyzer" was stressful. I spent a lot of time learning how to use AWS services and understanding the security rules of VS Code.
- **Technical Hurdles**: A major challenge was making sure the chat window could properly show images and styles. Setting up the connection between the interface and the background logic required a lot of trial and error to get right.
- **Device Access Issues**: While researching a **Voice-to-Text** feature to help users talk to the AI, I ran into a wall with Windows permissions. Even though I set everything up, the operating system blocked the microphone access for VS Code, which is a common security restriction I couldn't bypass in the given time.
- **Time Management**: Balancing learning new technologies while meeting team deadlines required a lot of self-discipline.

## 4. REFLECTION ON INDIVIDUAL CONTRIBUTION
I acted as the final "gatekeeper," making sure the product didn't just run, but worked correctly in real-life scenarios:

- **Connecting the AI Chat Interface**: I built the bridge that allows the AI to talk to the user. My specific work included:
    - **Security-First Architecture**: Following VS Code best practices, I designed the system so that the chat interface does not call the API directly. Instead, it sends messages to the extension backend, which then handles the actual data requests to AWS Lambda. This multi-step "proxy" flow (UI → Extension → Cloud → Extension → UI) ensures a more secure and stable connection.
    - **Setting up the Chat Connection**: Made sure the communication between the user and the cloud API was stable and fast, handling real-time data flows effectively.
    - **Improving User Experience**: Added a "Thinking..." status so users know the AI is working, and made the chat window automatically scroll to the newest message.
    - **Fixing Visual Issues**: Solved problems with how the chat window looked and behaved, making it match the user's VS Code theme (Light or Dark mode).
- **Real-world Testing**: This was my most hands-on contribution. I manually created errors on AWS to see if our AI could find them. I reported every logic error I found to the team so we could fix them.
- **Creating Demo Videos**: I wrote the scripts and recorded the demo videos to show how the system works. I made sure complex AI features were explained in a simple and convincing way for the audience.
- **Data & History Management**: I helped test the system that saves chat history, making sure that users never lose their conversations.
- **Voice Assistant R&D (Research & Development)**: I spearheaded the research into voice-controlled interactions using the Web Speech API. Although the feature faced hard "not-allowed" permission blocks from the Windows OS within the VS Code environment, my research documented these technical boundaries and proposed alternative authentication flows for future investigation.
- **Iterative Feedback Loop**: I served as the primary internal reviewer for the group's code. By providing detailed feedback on the Agent's response quality and classification logic, I ensured the product evolved through multiple iterations into a more polished state.

## 5. REFLECTION ON INDIVIDUAL SKILL DEVELOPMENT
- **Professional Skills**: I improved my debugging skills, learned how to write better technical documents, and gained experience in building VS Code extensions.
- **Soft Skills**: I developed better teamwork, learned how to argue for the best solutions, and became much faster at adapting to new software tools.

## 6. TAKE AWAY
The most important lesson I learned is: "System stability is more important than flashy features." Through testing and recording demos, I realized that no matter how "smart" an AI is, it needs a very solid foundation and strict testing.

If I could do this project again, I would:
- **Automate Testing Early**: Instead of testing everything by hand, I would build automated tests from day one to save time and be more accurate.
- **Focus on Security First**: I would suggest looking at security and permissions much earlier in the design phase.
- **Use Demos to Shape Features**: I would use demo recordings throughout the project to see if the features we are building are actually what a user needs.

This project helped me realize that being the one who tests and "tells the story" of the product is just as important as writing the code itself.

