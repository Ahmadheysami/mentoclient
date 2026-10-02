# Adult Panel Features

## Section 2 — My Goals

## 1. Overview

The **My Goals** feature allows users to define and track their personal goals across six different domains.

### 1.1 Goal Categories

The system supports the following six goal categories:

```json
{
  "business": "Career and Business",
  "financial": "Finance and Professional Development",
  "academic": "Education and Skills",
  "relation": "Emotions and Relationships",
  "health": "Health and Lifestyle",
  "sprituality": "Spirituality"
}
```

Users can select any of these six categories when creating a new goal.

### 1.2 Goal Duration and Expiration

Each goal has a defined target duration.

For example, if a user wants to achieve a goal within six months, they specify the desired duration when creating the goal. The system automatically calculates the goal's expiration date based on the specified duration.

The UI must allow users to specify and view the time required to achieve each goal.

The `goalExpiredAt` field stores the goal's expiration timestamp.

Once the expiration date is reached, the goal becomes inactive.

### 1.3 Goal-Setting Purpose

The purpose of this feature is to guide users toward achieving their goals through structured guidance, progress tracking, and periodic follow-ups.

---

## 2. Goal Data Structure

The following is an example of a goal document stored in the database:

```javascript
{
  id: "string",
  slug: "goal_business_module",
  userId: "",
  panel: "big",
  input: {
    domain: "business",
    targetTimeline: NumberInt("365"),
    currentScore: NumberInt("3"),
    description: "Hello, my name is Ahmad Heysami. I want to become a professional programmer. I am currently a full-stack developer and also want to learn IoT programming.",
    successMetric: "I have a background in JavaScript programming and am already proficient in it.",
    obstacles: "My current workload prevents me from focusing on learning.",
    goalExpiredAt: Double("1811663036142")
  },
  createdAt: ISODate("2026-05-30T07:43:56.148Z"),
  updatedAt: ISODate("2026-05-30T07:43:56.148Z")
}
```

### 2.1 Goal Fields

* `id`: Unique goal identifier.
* `slug`: Goal module identifier.
* `userId`: ID of the user who owns the goal.
* `panel`: The panel associated with the goal. For this feature, the value is `big`.
* `input.domain`: The selected goal category.
* `input.targetTimeline`: The target duration in days.
* `input.currentScore`: The user's self-assessed current score in the selected domain.
* `input.description`: A description of the user's goal.
* `input.successMetric`: The user's definition of success and the criteria they will use to measure it.
* `input.obstacles`: Challenges or obstacles that may prevent the user from achieving the goal.
* `input.goalExpiredAt`: The goal's expiration timestamp.
* `createdAt`: Goal creation timestamp.
* `updatedAt`: Last update timestamp.

---

# 3. Goal Lifecycle

The goal lifecycle consists of the following stages:

1. Create a new goal.
2. Retrieve and display the user's goals.
3. Start a goal.
4. Retrieve and display goal messages.
5. Submit weekly reviews and continue to the next week.
6. Track progress through a progress chart.
7. Deactivate the goal after its expiration date.

---

## 4. Create a New Goal

### 4.1 Workflow

When creating a new goal, the user must provide the following information:

* **Goal Category:** Select one of the six supported categories.
* **Target Duration:** Specify how many days the user expects to need to achieve the goal.
* **Current Score:** Rate their current ability or progress in the selected domain.
* **Goal Description:** Describe the goal they want to achieve.
* **Success Metric:** Explain what success means to them and how they will measure it.
* **Obstacles:** Identify the challenges that may prevent them from achieving the goal.

After the user submits the information, the system automatically calculates `goalExpiredAt` based on the specified target duration and creates the goal.

### 4.2 API — Create a Goal

* **URL:** `/.api/panels/shared/modules/goal`
* **Method:** Refer to the existing Swagger documentation.

### 4.3 Example Response

The following is an example of the API response after successfully creating a goal:

```json
{
  "success": true,
  "message": "Congratulations! Your goal has been created. You can get started.",
  "statusCode": 201,
  "goal": {
    "id": "14p4s8ks4ckmup9n8mt",
    "slug": "goal_business_module",
    "userId": "lvl1.14p4s8ksmwamuegfiy1.mntya",
    "panel": "big",
    "input": {
      "domain": "business",
      "targetTimeline": 365,
      "currentScore": 3,
      "description": "I want to improve my programming skills.",
      "successMetric": "I am highly proficient.",
      "obstacles": "I am lazy.",
      "goalExpiredAt": 1822378935413
    },
    "_id": "6abe1837b30f0494b7bbe318",
    "createdAt": "2026-10-01T08:22:15.414Z",
    "updatedAt": "2026-10-01T08:22:15.414Z",
    "__v": 0
  }
}
```

After successful creation, display an appropriate success message and make the newly created goal accessible to the user.

---

## 5. Retrieve the Goal List

### 5.1 Overview

After creating goals, users must be able to view their existing goals.

Display each goal with the following information:

* Goal title or description.
* Goal category.
* Target timeline.

### 5.2 Category-Based Navigation

Each of the six goal categories must have its own dedicated page in the UI.

When a user opens a category page, the application must send that category to the API as a required query parameter.

**Important:** The `category` query parameter is mandatory. Every request to retrieve the goal list must include it.

### 5.3 Pagination and Filtering

The goal list must support pagination and category-based filtering.

Supported query parameters:

* `category`: The selected goal category. Required.
* `page`: The current page number.
* `limit`: The number of goals per page.

The default page size must be **20 goals per request**.

### 5.4 API — Retrieve Goals

* **URL:** `/.api/panels/shared/modules/goal`
* **Method:** Refer to the existing Swagger documentation.
* **Query Parameters:** `category`, `page`, `limit`.

### 5.5 Example Response

```json
{
  "success": true,
  "goals": [
    {
      "_id": "6abe1837b30f0494b7bbe318",
      "id": "14p4s8ks4ckmup9n8mt",
      "slug": "goal_business_module",
      "userId": "lvl1.14p4s8ksmwamuegfiy1.mntya",
      "panel": "big",
      "input": {
        "domain": "business",
        "targetTimeline": 365,
        "currentScore": 3,
        "description": "I want to improve my programming skills.",
        "successMetric": "I am highly proficient.",
        "obstacles": "I am lazy.",
        "goalExpiredAt": 1822378935413
      },
      "createdAt": "2026-10-01T08:22:15.414Z",
      "updatedAt": "2026-10-01T08:22:15.414Z",
      "__v": 0
    }
  ]
}
```

---

## 6. Delete a Goal

Users must be able to delete their own goals using the goal's `id`.

### API — Delete a Goal

* **URL:** `/.api/panels/shared/modules/goal/{id}`
* **Method:** Refer to the existing Swagger documentation.
* **Path Parameters:**

  * `id`: The ID of the goal to delete.

Provide an appropriate confirmation interaction before deleting a goal.

---

## 7. Start a Goal

### 7.1 Overview

After creating a goal, the user can open its dedicated page.

The user must explicitly click the **Start Goal** button to begin the goal process for the first time.

When the goal starts:

1. The system initiates the goal.
2. The first guidance message is generated.
3. The application retrieves the messages associated with the goal.
4. The goal page displays the available messages to guide the user toward achieving their goal.

These messages serve as structured guidance throughout the goal's lifecycle.

### 7.2 API — Start a Goal

* **URL:** `/.api/panels/shared/modules/goal/{id}/start`
* **Method:** Refer to the existing Swagger documentation.
* **Path Parameters:**

  * `id`: The ID of the goal to start.

### 7.3 Example Response

```json
{
  "statusCode": 201,
  "success": true,
  "message": "Goal started.",
  "coins": 25571
}
```

After successfully starting the goal, retrieve its messages and display them on the goal's dedicated page.

---

## 8. Goal Messages

### 8.1 Retrieve Goal Messages

Once a goal has been started, retrieve its associated messages and display them to the user.

### API — Get Goal Messages

* **URL:** `/.api/panels/shared/modules/goal/{id}/messages`
* **Method:** Refer to the existing Swagger documentation.
* **Path Parameters:**

  * `id`: The ID of the goal.

### 8.2 Example Response

```json
{
  "success": true,
  "messages": [
    {
      "id": "14p4s8ks5nqmupa16a3",
      "slug": "goal_business_module",
      "complated": null,
      "moduleId": "14p4s8ks4ckmup9n8mt",
      "panel": "big",
      "userId": "lvl1.14p4s8ksmwamuegfiy1.mntya",
      "input": {
        "domain": "business",
        "currentScore": 3,
        "description": "I want to improve my programming skills.",
        "obstacles": "I am lazy.",
        "successMetric": "I am highly proficient.",
        "targetTimeline": 365,
        "model": "Gemini-3-Flash-Preview-0x2dd",
        "expiredAt": 1791448385547
      },
      "createdAt": "2026-10-01T08:33:05.547Z",
      "updatedAt": "2026-10-01T08:33:05.547Z"
    }
  ],
  "statusCode": 201
}
```

---

## 9. Retrieve a Single Message

Each goal message has its own detailed content.

When a user opens a specific message, retrieve its full content and display it in the appropriate format.

### API — Get Message Details

* **URL:** `/.api/panels/shared/modules/goal/messages/{id}/single`
* **Method:** Refer to the existing Swagger documentation.
* **Path Parameters:**

  * `id`: The ID of the requested message.

### Example Response

```json
{
  "success": true,
  "statusCode": 201,
  "result": "A long Markdown-formatted text containing the guidance message.",
  "input": {
    "domain": "business",
    "currentScore": 3,
    "description": "I want to improve my programming skills.",
    "obstacles": "I am lazy.",
    "successMetric": "I am highly proficient.",
    "targetTimeline": 365,
    "model": "Gemini-3-Flash-Preview-0x2dd",
    "expiredAt": 1791448385547
  }
}
```

The `result` field typically contains a long Markdown-formatted message.

Render this content as readable Markdown on the message details page.

---

## 10. Weekly Reviews and Starting the Next Week

### 10.1 Overview

Goal guidance messages follow a weekly cycle.

The system uses the `review` field in the database to determine when the user must submit a weekly review before proceeding to the next week.

### 10.2 Weekly Review Workflow

The process works as follows:

1. The user starts a goal and receives the first guidance message.
2. The user follows the guidance during the current week.
3. When the current weekly cycle is completed, the system creates a `review` field in the database.
4. The application checks the `review` field to determine whether the user must submit a review.
5. If `review` exists but is empty, prompt the user to write a review or note describing what happened during the current week.
6. The user submits their weekly review.
7. Once the review has been recorded and the required completion conditions have been met, the system can generate the next guidance message.
8. The user proceeds to the next weekly cycle.

### 10.3 Completion and Review Conditions

The `completed` field determines whether the current message has reached its completion state.

When `completed` has a value, a `review` field is also created.

The presence of the `review` field indicates that the weekly review process is available.

When the review has been submitted, the system can create the next message and begin the following week.

**Important:** An empty `review` field must be treated as a pending user action. The application must prompt the user to submit their review before allowing the next weekly message to be generated.

### 10.4 API — Submit Review and Start the Next Week

This endpoint handles the weekly review submission and the creation of the next guidance message.

* **URL:** `/.api/panels/shared/modules/goal/{id}/start-more-and-review`
* **Method:** Refer to the existing Swagger documentation.
* **Path Parameters:**

  * `id`: The ID of the goal.
* **Request Body:** Refer to the existing Swagger documentation and backend implementation.

Use this endpoint to submit the user's review and initiate the next weekly cycle.

---

## 11. Goal Progress Chart

### 11.1 Overview

Display the user's progress and self-assessed ability across all six goal categories using a **radar chart (spider chart)**.

The system uses numerical scores ranging from **0 to 10** for the different categories.

### 11.2 Chart Requirements

* Display all six goal categories on a single radar chart.
* Use the relevant scores to visualize the user's current strengths and progress across the categories.
* Keep the chart minimal, elegant, and easy to understand.
* Ensure the chart fits the visual design of the Adult Panel.
* Make the visualization clear and readable on mobile devices.

### 11.3 API

The following endpoint was provided for the progress chart:

* **URL:** `/.api/panels/shared/modules/goal/{id}/start-more-and-review`

**Important:** The provided endpoint is also used for weekly review submission and starting the next week. Verify the backend implementation and Swagger documentation to determine the correct data source and response structure for the progress chart before integrating it.

---

# 12. General Implementation Requirements

* Examine the existing backend implementation and Swagger documentation before integrating the APIs.
* Follow the existing project architecture and conventions.
* Route all API requests through the Nuxt server, rather than calling backend APIs directly from the client.
* Use Pinia for state management, following the existing stores.
* Keep the six goal categories accessible through their own dedicated UI pages.
* Ensure category filtering and pagination work together.
* Use the existing API response structures without assuming undocumented fields.
* Render long guidance messages and reports using Markdown.
* Provide clear loading, success, empty, and error states where appropriate.
* Ensure all interactions are responsive and mobile-friendly.
* Maintain the Adult Panel's minimal, modern, and premium visual style.
