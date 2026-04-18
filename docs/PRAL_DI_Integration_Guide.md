# Digital Invoicing (DI) API - Developer Guide

**Version:** 1.1  
**Last Updated:** July 24, 2025  
**Base URL (Sandbox):** `https://gw.fbr.gov.pk/di_data/v1/di`  
**Base URL (Production):** `https://gw.fbr.gov.pk/di_data/v1/di`

---

## 1. Authentication

All API requests require a security token in the Authorization header.

```
Authorization: Bearer <YOUR_SECURITY_TOKEN>
```

- Token validity: 5 years
- Issued by: PRAL
- Endpoint routing determined by token (sandbox vs production)

---

## 2. Core API Methods

### 2.1 Post Invoice Data

**Endpoint:** `/postinvoicedata` (Sandbox: `_sb`)  
**Method:** POST  
**Purpose:** Submit invoice data in real-time

#### Request Schema

```json
{
  "invoiceType": "Sale Invoice",
  "invoiceDate": "2025-04-21",
  "sellerNTNCNIC": "0786909",
  "sellerBusinessName": "Company Name",
  "sellerProvince": "Sindh",
  "sellerAddress": "Karachi",
  "buyerNTNCNIC": "1000000000000",
  "buyerBusinessName": "Buyer Name",
  "buyerProvince": "Sindh",
  "buyerAddress": "Karachi",
  "buyerRegistrationType": "Registered",
  "invoiceRefNo": "",
  "scenarioId": "SN001",
  "items": [
    {
      "hsCode": "0101.2100",
      "productDescription": "Product Description",
      "rate": "18%",
      "uoM": "Numbers, pieces, units",
      "quantity": 1.0000,
      "totalValues": 1180.00,
      "valueSalesExcludingST": 1000.00,
      "fixedNotifiedValueOrRetailPrice": 0.00,
      "salesTaxApplicable": 180.00,
      "salesTaxWithheldAtSource": 0.00,
      "extraTax": 0.00,
      "furtherTax": 120.00,
      "sroScheduleNo": "SRO123",
      "fedPayable": 0.00,
      "discount": 0.00,
      "saleType": "Goods at standard rate (default)",
      "sroItemSerialNo": ""
    }
  ]
}
```

#### Field Reference

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| invoiceType | string | Yes | "Sale Invoice" or "Debit Note" |
| invoiceDate | date | Yes | Format: YYYY-MM-DD |
| sellerNTNCNIC | string | Yes | 7 or 13 digits |
| sellerBusinessName | string | Yes | Business name |
| sellerProvince | string | Yes | Use reference API 5.1 |
| sellerAddress | string | Yes | Business address |
| buyerNTNCNIC | string | Yes* | *Optional if unregistered |
| buyerBusinessName | string | Yes | Buyer name |
| buyerProvince | string | Yes | Use reference API 5.1 |
| buyerAddress | string | Yes | Buyer address |
| buyerRegistrationType | string | Yes | "Registered" or "Unregistered" |
| invoiceRefNo | string | Conditional | Required for debit notes |
| scenarioId | string | Sandbox only | Refer to section 5 |
| items | array | Yes | At least one item required |

#### Item Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| hsCode | string | Yes | HS code of product |
| productDescription | string | Yes | Product details |
| rate | string | Yes | Tax rate (e.g., "18%") |
| uoM | string | Yes | Unit of measurement |
| quantity | number | Yes | Decimal format |
| totalValues | number | Yes | Including tax |
| valueSalesExcludingST | number | Yes | Excluding sales tax |
| fixedNotifiedValueOrRetailPrice | number | Yes | Item-based price |
| salesTaxApplicable | number | Yes | Excluding further/extra tax |
| salesTaxWithheldAtSource | number | Yes | Can be 0.00 |
| extraTax | number | Optional | If applicable |
| furtherTax | number | Optional | If applicable |
| sroScheduleNo | string | Optional | SRO schedule number |
| fedPayable | number | Optional | Federal excise duty |
| discount | number | Optional | Discount amount |
| saleType | string | Yes | Type of sale transaction |
| sroItemSerialNo | string | Optional | Item serial in SRO |

#### Success Response (200)

```json
{
  "invoiceNumber": "7000007DI1747119701593",
  "dated": "2025-05-13 12:01:41",
  "validationResponse": {
    "statusCode": "00",
    "status": "Valid",
    "error": "",
    "invoiceStatuses": [
      {
        "itemSNo": "1",
        "statusCode": "00",
        "status": "Valid",
        "invoiceNo": "7000007DI1747119701593-1",
        "errorCode": "",
        "error": ""
      }
    ]
  }
}
```

#### Error Response

```json
{
  "dated": "2025-05-13 13:09:05",
  "validationResponse": {
    "statusCode": "01",
    "status": "Invalid",
    "errorCode": "0052",
    "error": "Provide proper HS Code with invoice no.",
    "invoiceStatuses": null
  }
}
```

---

### 2.2 Validate Invoice Data

**Endpoint:** `/validateinvoicedata` (Sandbox: `_sb`)  
**Method:** POST  
**Purpose:** Validate invoice before submission

Request schema identical to POST method. Returns validation status without storing the invoice.

#### Success Response

```json
{
  "dated": "2025-05-13 13:13:07",
  "validationResponse": {
    "statusCode": "00",
    "status": "Valid",
    "errorCode": null,
    "error": "",
    "invoiceStatuses": [
      {
        "itemSNo": "1",
        "statusCode": "00",
        "status": "Valid",
        "errorCode": null,
        "error": ""
      }
    ]
  }
}
```

---

## 3. Reference APIs

### 3.1 Province Codes

**Endpoint:** `/pdi/v1/provinces`  
**Method:** GET  
**No parameters required**

```json
[
  { "stateProvinceCode": 7, "stateProvinceDesc": "PUNJAB" },
  { "stateProvinceCode": 8, "stateProvinceDesc": "SINDH" }
]
```

### 3.2 Document Types

**Endpoint:** `/pdi/v1/doctypecode`  
**Method:** GET

```json
[
  { "docTypeId": 4, "docDescription": "Sale Invoice" },
  { "docTypeId": 9, "docDescription": "Debit Note" }
]
```

### 3.3 Item Descriptions (HS Codes)

**Endpoint:** `/pdi/v1/itemdesccode`  
**Method:** GET

```json
[
  {
    "hS_CODE": "8432.1010",
    "description": "AGRICULTURAL MACHINERY..."
  }
]
```

### 3.4 SRO Item Codes

**Endpoint:** `/pdi/v1/sroitemcode`  
**Method:** GET

```json
[
  { "srO_ITEM_ID": 724, "srO_ITEM_DESC": "9" }
]
```

### 3.5 Transaction Types

**Endpoint:** `/pdi/v1/transtypecode`  
**Method:** GET

```json
[
  { "transactioN_TYPE_ID": 82, "transactioN_DESC": "DTRE goods" }
]
```

### 3.6 Unit of Measurement

**Endpoint:** `/pdi/v1/uom`  
**Method:** GET

```json
[
  { "uoM_ID": 77, "description": "Square Metre" },
  { "uoM_ID": 13, "description": "KG" }
]
```

### 3.7 SRO Schedule

**Endpoint:** `/pdi/v1/SroSchedule`  
**Parameters:** `rate_id`, `date`, `origination_supplier_csv`

```json
[
  { "srO_ID": 7, "srO_DESC": "Zero Rated Gas" }
]
```

### 3.8 Sale Type to Rate

**Endpoint:** `/pdi/v2/SaleTypeToRate`  
**Parameters:** `date`, `transTypeId`, `originationSupplier`

```json
[
  {
    "ratE_ID": 734,
    "ratE_DESC": "18% along with rupees 60 per kilogram",
    "ratE_VALUE": 18
  }
]
```

### 3.9 HS Code with UOM

**Endpoint:** `/pdi/v2/HS_UOM`  
**Parameters:** `hs_code`, `annexure_id`

```json
[
  { "uoM_ID": 77, "description": "Square Meter" }
]
```

### 3.10 SRO Item Details

**Endpoint:** `/pdi/v2/SROItem`  
**Parameters:** `date`, `sro_id`

```json
[
  { "srO_ITEM_ID": 17853, "srO_ITEM_DESC": "50" }
]
```

### 3.11 Registration Status (STATL)

**Endpoint:** `/dist/v1/statl`  
**Method:** POST

```json
{
  "regno": "0788762",
  "date": "2025-05-18"
}
```

Response:
```json
{
  "status code": "01",
  "status": "In-Active"
}
```

### 3.12 Registration Type

**Endpoint:** `/dist/v1/Get_Reg_Type`  
**Method:** POST

```json
{
  "Registration_No": "0788762"
}
```

Response:
```json
{
  "statuscode": "00",
  "REGISTRATION_NO": "0788762",
  "REGISTRATION_TYPE": "Registered"
}
```

---

## 4. HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | OK - Request successful |
| 401 | Unauthorized - Invalid/missing token |
| 500 | Internal Server Error - Contact administrator |

---

## 5. Sales Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 0001 | Seller not registered for sales tax | Provide valid seller NTN/registration |
| 0002 | Invalid buyer registration no/NTN | Buyer NTN must be 7/9 digits, registration 13 digits |
| 0003 | Invalid invoice type | Use "Sale Invoice" or "Debit Note" |
| 0005 | Invalid date format | Use YYYY-MM-DD format |
| 0009 | Buyer registration missing | Provide buyer registration number |
| 0010 | Buyer name missing | Provide buyer business name |
| 0012 | Buyer registration type missing | Specify "Registered" or "Unregistered" |
| 0019 | HS Code missing | Provide valid HS code |
| 0020 | Rate missing | Provide tax rate |
| 0021 | Value of sales excluding ST missing | Provide sales value |
| 0026 | Invoice ref number required | Required for debit/credit notes |
| 0046 | Rate not provided | Provide valid rate for sale type |
| 0052 | Invalid HS Code for sale type | Provide HS code matching sale type |
| 0058 | Self-invoicing not allowed | Buyer and seller cannot be same |
| 0401 | Seller NTN/CNIC invalid token | Verify seller NTN is 7/13 digits with valid token |
| 0402 | Buyer NTN/CNIC invalid token | Verify buyer NTN is 7/13 digits with valid token |

---

## 6. Purchase Error Codes

| Code | Message | Solution |
|------|---------|----------|
| 0156 | Invalid NTN/Reg No. | Provide valid NTN or registration number |
| 0157 | Buyer not registered for sales tax | Provide valid buyer registration/NTN |
| 0159 | FTN holder as seller not allowed | FTN holders cannot be sellers in purchases |
| 0160 | Buyer name missing | Provide valid buyer name |
| 0162 | Sale type missing | Provide valid sale/purchase type |
| 0167 | Value of sales excluding ST missing | Provide sales value |
| 0173 | Invalid invoice number format | Use alphanumeric with hyphens (e.g., Inv-001) |
| 0174 | Sales tax missing | Provide valid sales tax amount |

---

## 7. Sandbox Testing Scenarios

Use `scenarioId` in sandbox requests only.

| Scenario | Description |
|----------|-------------|
| SN001 | Standard rate goods to registered buyers |
| SN002 | Standard rate goods to unregistered buyers |
| SN003 | Steel melting and re-rolling |
| SN004 | Ship breaking |
| SN005 | Reduced rate goods |
| SN006 | Exempt goods |
| SN007 | Zero-rated goods |
| SN008 | 3rd schedule goods |
| SN009 | Cotton ginners purchase (textile) |
| SN010 | Telecom services |
| SN011 | Toll manufacturing (steel) |
| SN012 | Petroleum products |
| SN013 | Electricity supply to retailers |
| SN014 | Gas to CNG stations |
| SN015 | Mobile phones |
| SN016 | Processing/conversion of goods |
| SN017 | Goods with FED in ST mode |
| SN018 | Services with FED in ST mode |
| SN019 | Services |
| SN020 | Electric vehicles |
| SN021 | Cement/concrete blocks |
| SN022 | Potassium chlorate |
| SN023 | CNG sales |
| SN024 | Goods per SRO 297(1)/2023 |
| SN025 | Drugs at fixed ST rate |
| SN026-SN028 | Retail sales (standard/reduced/schedule) |

---

## 8. Invoice Types

- **Sale Invoice** - Normal sales transaction
- **Debit Note** - Requires `invoiceRefNo` from original invoice

---

## 9. Buyer Registration Types

- **Registered** - Registered with tax authority
- **Unregistered** - Not registered (NTN/CNIC optional)

---

## 10. Sale Types

- Goods at standard rate (default)
- Goods at reduced rate
- Exempt goods
- Zero-rated goods
- 3rd schedule goods
- Steel melting and re-rolling
- Ship breaking
- Cotton ginners
- Telecommunication services
- Toll manufacturing
- Petroleum products
- Electricity supply
- Gas supply
- Mobile phones
- Processing/conversion
- Electric vehicles
- Cement/concrete blocks
- Potassium chlorate
- CNG sales
- Non-adjustable supplies

---

## 11. Common Integration Steps

1. **Get Authentication Token** - Request from PRAL
2. **Fetch Reference Data** - Call reference APIs to populate dropdowns
3. **Build Invoice Object** - Use provided schema
4. **Validate First** - Call validate endpoint to check before posting
5. **Post Invoice** - Submit validated invoice data
6. **Handle Response** - Process invoice number or error codes

---

## 12. QR Code & Logo Requirements

- **QR Code Version:** 2.0 (25×25)
- **Dimensions:** 1.0 x 1.0 inch
- Must be printed on all issued invoices with FBR Digital Invoicing System logo

---

## 13. Quick Reference URLs

```
Sandbox Base: https://gw.fbr.gov.pk/di_data/v1/di
Production Base: https://gw.fbr.gov.pk/di_data/v1/di

Post (Sandbox): https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata_sb
Post (Prod): https://gw.fbr.gov.pk/di_data/v1/di/postinvoicedata

Validate (Sandbox): https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata_sb
Validate (Prod): https://gw.fbr.gov.pk/di_data/v1/di/validateinvoicedata

Provinces: https://gw.fbr.gov.pk/pdi/v1/provinces
Document Types: https://gw.fbr.gov.pk/pdi/v1/doctypecode
Items: https://gw.fbr.gov.pk/pdi/v1/itemdesccode
UOM: https://gw.fbr.gov.pk/pdi/v1/uom
Rates: https://gw.fbr.gov.pk/pdi/v2/SaleTypeToRate
Registration: https://gw.fbr.gov.pk/dist/v1/Get_Reg_Type
Status: https://gw.fbr.gov.pk/dist/v1/statl
```

---

**For Support:** Contact PRAL SD Wing  
**Document Version:** 1.1 | **Last Updated:** July 24, 2025