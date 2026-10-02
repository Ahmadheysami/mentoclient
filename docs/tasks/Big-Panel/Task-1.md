# Adult Panel Features

## 1. Astrology — Astrological Chart Calculation

### 1.1 Overview

The Astrology feature calculates and generates the user's astrological chart.

The workflow is as follows:

1. The user enters the required personal information.
2. The application sends a request to the relevant API endpoint.
3. The backend processes the request and generates the astrological chart.
4. The application receives the response and displays the results to the user.

### 1.2 City Data API

**Important:** Use the following external API to retrieve city names and their corresponding latitude and longitude coordinates.

* **API URL:** `https://iran-locations-api.ir/api/v1/fa/cities`

**Response:**

```json
[
  {
    "name": "string",
    "latitude": "string",
    "longitude": "string"
  }
]
```

Use this API as the source of city data and geographic coordinates when implementing the Astrology form.

### 1.3 API Documentation

**API Documentation Type:** Swagger

**API Documentation URL:** `http://localhost:3001/.api/docs`

**Swagger Section:** `Panels Shared`

### 1.4 API Endpoints

#### 1.4.1 Start Astrology Calculation

Initiate the astrological chart calculation using the user's submitted information.

* **URL:** `/.api/panels/shared/modules/astrology`
* **Method:** Refer to the existing Swagger documentation.
* **Request Body:**

```json
{
  "province": "string",
  "city": "string",
  "lat": 1,
  "long": 1,
  "time": "14:30:00",
  "solarDate": "1370/05/15",
  "country": "string",
  "timezone": "string",
  "gregorianDate": "2005-06-01"
}
```

**Field Descriptions:**

* `province`: Province name.
* `city`: City name.
* `lat`: Latitude of the selected city.
* `long`: Longitude of the selected city.
* `time`: User's birth time.
* `solarDate`: User's birth date in the Solar Hijri calendar.
* `country`: Country name.
* `timezone`: Time zone.
* `gregorianDate`: User's birth date in the Gregorian calendar.

**Response:**

```json
{
  "success": "boolean",
  "result": "string",
  "token": "string"
}
```

#### 1.4.2 Retrieve Astrology Results

Retrieve the list of the user's previous Astrology calculation results.

* **URL:** `/.api/panels/shared/modules/astrology/results`
* **Method:** Refer to the existing Swagger documentation.
* **Response:** Refer to the existing Swagger documentation and backend implementation for the response structure.

#### 1.4.3 Retrieve a Single Astrology Result

Retrieve a specific Astrology result by its ID.

* **URL:** `/.api/panels/shared/modules/astrology/{id}/single`
* **Method:** Refer to the existing Swagger documentation.
* **Path Parameters:**

  * `id`: The ID of the requested Astrology result.
* **Response:** Refer to the existing Swagger documentation and backend implementation for the response structure.

#### 1.4.4 Restart Astrology

Allow the user to restart or reactivate the Astrology feature when their remaining coin balance reaches the specified threshold.

**Activation Rules:**

* When the user's remaining coin balance reaches **8 coins or fewer**, display a button labeled **"Reactivate Astrology"**.

* When the user has **fewer than 8 coins**, redirect them to `/wallet` so they can purchase or add more coins before reactivating Astrology.

* **URL:** `/.api/panels/shared/modules/astrology/restart`

* **Method:** Refer to the existing Swagger documentation.

* **Request Body:** None.

**Response:**

```json
{
  "message": "string",
  "success": "boolean",
  "statusCode": 200
}
```

### 1.5 Astrology Results and Token Balance

The `result` field typically contains a long Markdown-formatted text representing the generated Astrology report.

The `token` field returns the user's remaining token balance.

Display the generated report in a readable format that supports Markdown content.

The token balance should be handled and presented consistently with the coin balance displayed in the `/wallet` section.

---

## 2. Important Business Rules

### 2.1 One-Time Astrology Activation

Astrology can only be initiated once using the user's submitted personal information.

The user must provide their information accurately before starting the calculation.

**Important:** Once the Astrology calculation has been initiated, the user cannot update or modify the submitted personal information.

Make this restriction clear to the user before they proceed.

---

## 3. UI/UX Requirements

### 3.1 Pre-Activation Confirmation

Before initiating the Astrology calculation, create an interactive confirmation page or modal.

The confirmation interface must:

* Clearly explain that the user is about to start the Astrology calculation.
* Emphasize the importance of entering accurate personal information.
* Explicitly warn the user that their submitted information cannot be updated after activation.
* Require the user's confirmation before sending the initial API request.
* Provide clear actions to either proceed or cancel.

Only initiate the Astrology calculation after the user explicitly confirms.
