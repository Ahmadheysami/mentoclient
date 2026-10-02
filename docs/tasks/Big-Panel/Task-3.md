# Adult Panel Features

## Section 3 — Pro Chatbot

### 1. Overview

The Pro Chatbot must use **exactly the same functionality and workflow as the existing `/mentobot`**, while featuring an improved, more minimal, and polished UI.

Reimplement the existing `/mentobot` functionality within the Adult Panel, preserving its underlying behavior, interaction patterns, and API integration.

### 2. API Endpoint Differences

The Pro Chatbot uses the same chatbot system as `/mentobot`, but with different API endpoints.

**Important:** Use the following endpoints instead of the `/normal-user` endpoints used by the existing chatbot.

#### 2.1 Create and Initialize a Chatbot

Use the following endpoint to create and initialize a new chatbot session.

* **URL:** `/.api/panels/shared/modules/bot/new`
* **Method:** Refer to the existing Swagger documentation and `/mentobot` implementation.

**Do not use:**

`/.api/panels/shared/modules/bot/new/normal-user`

#### 2.2 Send Messages and Receive Responses

Use the following endpoint to send messages to the chatbot and receive its responses.

* **URL:** `/.api/panels/shared/modules/bot/{chatId}/chat`
* **Method:** Refer to the existing Swagger documentation and `/mentobot` implementation.
* **Path Parameters:**

  * `chatId`: The ID of the current chatbot session.

**Do not use:**

`/.api/panels/shared/modules/bot/{chatId}/chat/normal-user`

### 3. Implementation Requirements

* **Existing Functionality:** Reproduce the existing `/mentobot` functionality exactly, preserving its established workflow and behavior.
* **API Integration:** Use the Pro-specific API endpoints defined in this task.
* **UI/UX Improvements:** Redesign the interface to be more minimal, modern, polished, and visually appealing than the existing `/mentobot`.
* **Consistency:** Maintain the same underlying chatbot interaction mechanism while improving the overall user experience.
* **Reusability:** The chatbot system is intended to be used across other Pro panels as well. Design the implementation and UI with this broader usage in mind.

### 4. Design Requirements

Create a refined, minimal, and professional chatbot interface that fits the Adult Panel's visual identity.

The new design must improve the existing `/mentobot` appearance without changing its core functionality or interaction workflow.

Ensure the implementation can be reused by the other Pro panels while maintaining a consistent and polished chatbot experience.
