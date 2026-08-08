# Blossom & Buds Floral Artistry — Business Documentation

**Last Updated**: August 2026  
**Version**: 1.1  
**Audience**: Business owners, operations staff, new team members

---

## Table of Contents

1. [Business Overview](#1-business-overview)
2. [Customer-Facing Features](#2-customer-facing-features)
   - 2.1 [Browsing & Discovery](#21-browsing--discovery)
   - 2.2 [Product Details](#22-product-details)
   - 2.3 [Shopping Cart](#23-shopping-cart)
   - 2.4 [Checkout & Payment](#24-checkout--payment)
   - 2.5 [Customer Accounts](#25-customer-accounts)
   - 2.6 [Order Tracking](#26-order-tracking)
   - 2.7 [Reviews & Ratings](#27-reviews--ratings)
   - 2.8 [Promotions & Discounts](#28-promotions--discounts)
   - 2.9 [Shipping & Delivery](#29-shipping--delivery)
   - 2.10 [Static Content Pages](#210-static-content-pages)
3. [Admin Features](#3-admin-features)
   - 3.1 [Dashboard & Metrics](#31-dashboard--metrics)
   - 3.2 [Product Management](#32-product-management)
   - 3.3 [Category Management](#33-category-management)
   - 3.4 [Order Management](#34-order-management)
   - 3.5 [Customer Management](#35-customer-management)
   - 3.6 [Promotions Management](#36-promotions-management)
   - 3.7 [Review Moderation](#37-review-moderation)
   - 3.8 [Delivery Partners](#38-delivery-partners)
   - 3.9 [WhatsApp CRM](#39-whatsapp-crm)
   - 3.10 [Email Marketing](#310-email-marketing)
   - 3.11 [One-Time Consent Migration](#311-one-time-consent-migration)
   - 3.12 [Settings & Configuration](#312-settings--configuration)
   - 3.13 [Homepage & Feature Images](#313-homepage--feature-images)
4. [Automated & Background Features](#4-automated--background-features)
5. [External Services & Integrations](#5-external-services--integrations)
6. [Key Business Rules](#6-key-business-rules)
7. [Operational Workflows](#7-operational-workflows)

---

## 1. Business Overview

**Blossom & Buds** is an e-commerce platform for a floral artistry business. It allows customers to browse, purchase, and review floral products online. The business serves both Indian customers (paying via Razorpay) and international customers (coordinated via WhatsApp).

The platform consists of:

- A **customer-facing storefront** (website) for browsing, shopping, and account management.
- An **admin panel** for managing the entire business: products, orders, customers, promotions, and analytics.
- **Automated communications** via WhatsApp, Email, and SMS for order updates and payment reminders.

---

## 2. Customer-Facing Features

### 2.1 Browsing & Discovery

**Home Page**
- A landing page with a hero banner carousel (rotating feature images managed by admin).
- A section for **New Arrivals** (the 12 most recently added products).
- A section for **Featured Products** (up to 12 products hand-picked by admin).
- Cart suggestion products displayed to encourage additional purchases.

**Categories**
- Customers can browse all product categories in a grid view.
- Clicking a category shows all products belonging to it.
- Categories have a name, description, image, and a custom sort order set by admin.

**Search**
- Customers can search products by name or description keyword.
- Search results can be filtered by category and price range.
- Results are paginated (shown in pages).
- Category names are also searchable.

**Featured Products Page**
- A dedicated page listing all products that admin has marked as featured.

---

### 2.2 Product Details

Each product page shows:

- **Name, Description, Price**
- **Product Images** — multiple images with a primary image shown first; customers can view all images.
- **In-Stock Status** — if out of stock, a "Notify Me" button appears (see Back-in-Stock below).
- **Product Options** — configurable variants (e.g., Color, Size, Ribbon Type) with optional additional pricing per option value (e.g., premium colour = +₹100).
- **Reviews** — approved customer reviews with ratings, comments, and images.
- **Average Rating** — calculated from all approved reviews.

**Back-in-Stock Alerts**
- If a product is out of stock, customers can enter their email to be notified when it comes back.
- Logged-in customers are automatically linked; anonymous users provide an email.

---

### 2.3 Shopping Cart

- Customers add products to a cart (stored in browser local storage, persisted across sessions for logged-in users).
- Quantity can be adjusted or items removed.
- Cart shows item subtotal, estimated shipping, and grand total.
- **Cart Suggestions** — a curated list of additional products shown on the cart page, managed by admin.
- Coupon codes can be applied to the cart before checkout.

---

### 2.4 Checkout & Payment

**Checkout Flow**
1. Customer reviews cart, enters or selects a shipping address.
2. Selects a delivery partner (courier service).
3. Applies a coupon (optional).
4. Reviews totals (subtotal, shipping, discount, GST, grand total).
5. Proceeds to payment.

**Payment Methods**

| Customer Location | Payment Method | Flow |
|---|---|---|
| India | Razorpay (cards, UPI, net banking, wallets) | Razorpay Checkout popup; payment confirmed on success |
| International | WhatsApp | Customer is directed to a WhatsApp chat with pre-filled order details; payment arranged manually |

**Checkout Intent (Draft Tracking)**
- When a customer initiates checkout but does not complete payment, the system saves a "CheckoutIntent" record.
- This is used to send automatic payment reminders (see Section 4).

**Order Confirmation**
- On successful payment, an order is created with a unique **Public Code** (e.g., `BB250001`).
- Confirmation is sent via email and optionally WhatsApp.

---

### 2.5 Customer Accounts

**Registration Options**
- Email + Password (standard sign-up with email verification).
- Google Sign-In (single click, no password needed).
- Phone + OTP (SMS-based, for phone-first customers).

**Email Verification**
- After email registration, a 6-digit OTP is sent to the customer's email.
- The customer must verify their email before they can log in (or can verify and log in simultaneously).
- OTP can be resent if not received.

**Password Reset**
- Customer requests reset with their email.
- A 6-digit OTP is sent to that email.
- Customer enters OTP + new password to complete the reset.

**Profile Management**
- Customers can update their name, email, and phone.
- Multiple saved addresses per customer.
- One address can be marked as the **default** (auto-selected at checkout).
- Addresses can be added, edited, or deleted.

**Notification Preferences**
- Two toggles on the profile page: **SMS notifications** (order confirmed, dispatched, delivered)
  and **WhatsApp updates** (offers, new arrivals, promotions).
- Consent is granted at registration by accepting the Terms & Conditions / Privacy Policy —
  there is no separate opt-in checkbox — and can be withdrawn here at any time.
- A phone number is required to enable either channel. Customers who signed up with Google and
  have no phone on file are asked to add one first.
- Turning the WhatsApp toggle off removes the customer from all marketing campaigns. Replying
  `STOP` to any WhatsApp message does the same thing.

**Order History**
- Customers can see all their past and current orders.
- Each order shows status, total, items, and a link to the tracking page.

---

### 2.6 Order Tracking

- Orders are accessible by their Public Code (e.g., `BB250001`), even without logging in.
- The order page shows:
  - Current status (Ordered, Dispatched, Delivered, Cancelled, Refunded).
  - Timeline of status changes and events.
  - Courier name and tracking number (with link to courier's tracking page, once dispatched).
  - Shipping address used for the order.
  - Itemised order breakdown.
  - Payments recorded.

---

### 2.7 Reviews & Ratings

**Submitting a Review**
- Customers who have placed an order can write a review for any product.
- A review includes: rating (1–5 stars), title, comment, and optional images.
- HEIC photos (iPhone format) are automatically converted to JPEG.
- Reviews are submitted in a **Pending** state and must be approved by admin before appearing publicly.

**Viewing Reviews**
- The product page shows all **Approved** reviews.
- A dedicated "Reviews" page lets customers browse all approved reviews across all products.
- Reviews can be searched and paginated.

**Review Images**
- Customers can attach photos to their reviews.
- Images are stored securely and shown inline (with caching for fast loading).

---

### 2.8 Promotions & Discounts

**Coupons**
- Customers can enter a coupon code at checkout.
- Before applying, the system shows a **preview** of the discount (how much they save).
- Coupons can be:
  - **Percentage off** (e.g., 10% off total).
  - **Flat discount** (e.g., ₹200 off).
- Coupons can have:
  - Minimum order total required.
  - Minimum number of items required.
  - Start and end date (limited-time offers).
  - Global usage limit (e.g., only 100 uses total).
  - Per-customer usage limit (e.g., one use per customer).
- Some coupons are hidden from customers and only applied by admin (e.g., loyalty discounts given over phone).

**Global Sale / Festival Offers**
- Admin can activate a site-wide percentage discount (e.g., 15% off for Diwali).
- The discount applies to all products, except those specifically excluded by admin.
- Only one global sale can be active at a time.
- The sale has a start and end date/time.
- Shown to customers automatically when active.

---

### 2.9 Shipping & Delivery

**Free Shipping**
- Orders above a configurable threshold (set by admin in Settings) qualify for free shipping.
- The threshold amount is visible to customers on the cart and checkout pages.

**Delivery Partners**
- Multiple courier options can be available (e.g., DHL, FedEx, local couriers).
- Admin can control which couriers are active and visible to customers.
- Each courier has a fixed or rule-based fee.

**Shipping Fees**
- Fees are calculated based on delivery location (district, state, or default/nationwide rate).
- More specific rules override general ones (district > state > default).
- Customers can get a fee quote before confirming checkout.

**Tracking**
- Once an order is dispatched, admin enters the tracking number and selects the courier.
- A direct link to the courier's tracking page is provided (e.g., DHL tracking URL pre-filled with the tracking number).
- A tracking email is sent to the customer when the order is dispatched.

---

### 2.10 Static Content Pages

- The platform supports CMS pages for static content: Terms of Service, Privacy Policy, Shipping Policy, Return Policy, About Us, etc.
- Pages are managed by admin (add, edit, delete).
- Each page has a unique URL slug (e.g., `/policies/terms-of-service`).
- Content is HTML-formatted rich text.
- Every edit creates a new **revision** (version history preserved).

---

## 3. Admin Features

The admin panel is a separate, password-protected section of the website for business staff.

### 3.1 Dashboard & Metrics

The main dashboard shows key business metrics at a glance:

| Metric | Description |
|---|---|
| Total Orders | Count of all orders |
| Total Revenue | Sum of all order grand totals |
| Total Customers | Count of registered customers |
| Total Reviews | Count of all reviews (by status) |
| Order Trend | Daily / weekly / monthly order count + revenue chart |
| Top Products | Best-selling products (by number of orders, configurable range) |
| Top Categories | Most popular categories (by order count) |
| Customer Growth | 12-month new customer registrations chart |
| Shipping Trends | Orders by delivery partner over 12 months |

---

### 3.2 Product Management

Admin can:

- **Create products**: Set name, description, price, active/visible/featured status.
- **Edit products**: Update any product field.
- **Soft-delete products**: Mark as deleted (not shown to customers; data retained).
- **Toggle visibility**: Hide a product from the storefront without deleting it (e.g., seasonal products).
- **Toggle stock status**: Mark as in-stock or out-of-stock.
- **Mark as featured**: Add/remove from the Featured Products section.
- **Manage images**: Upload multiple product images, set a primary image, reorder, update alt text, delete.
- **Direct browser upload**: Admin can upload images directly from browser to cloud storage (via presigned URL), then attach to the product.
- **Manage options/variants**: Add options like "Color" or "Size" with values (Red, Blue, Small, Medium). Each value can have an additional price.
- **Link to categories**: Associate a product with one or more categories.
- **Exclude from global discount**: Prevent a product from being discounted during site-wide sales.

---

### 3.3 Category Management

Admin can:

- **Create, edit, delete categories**: Name, description, slug, and image.
- **Upload category image**: Displayed in the category grid.
- **Reorder categories**: Drag-and-drop sort order for the storefront display.
- **Link products to categories**: Products can belong to multiple categories.

---

### 3.4 Order Management

Admin can:

- **View all orders**: Paginated list with filtering by status (Ordered, Dispatched, Delivered, Cancelled, Refunded, Returned & Refunded) and date range.
- **View order detail**: Full order information — customer, address, items, payments, events timeline.
- **Create orders manually**: Admin can create orders on behalf of customers (e.g., phone orders, WhatsApp orders).
- **Edit orders**: Update order details, replace items.
- **Update order status**: Move order through the lifecycle; each change is logged with a timestamp and the actor.
- **Add items to an order**: Post-creation item additions.
- **Record payments**: Log payment amounts, methods (Razorpay, cash, bank transfer, WhatsApp payment).
- **Enter tracking information**: Add courier name, tracking number; a tracking email is sent to customer.
- **Add notes**: Internal notes on an order (visible in events timeline).
- **Print invoice / packing slip**: Generate PDF documents for the order (A4 or thermal label format with QR code for tracking).

**Order Status Values**:
- **Ordered**: Payment received, order confirmed.
- **Dispatched**: Order handed to courier.
- **Delivered**: Customer has received the order.
- **Cancelled**: Order cancelled (any stage before delivery).
- **Refunded**: Payment refunded.
- **Returned & Refunded**: Product returned by customer and refunded.

---

### 3.5 Customer Management

Admin can:

- **View all customers**: Full list with contact details.
- **Create customers**: Manually register a customer (e.g., for WhatsApp/phone orders).
- **Edit customers**: Update name, email, phone.
- **View customer orders**: See all orders placed by a specific customer.
- **Manage customer addresses**: View, add, update, or remove addresses on behalf of a customer.

---

### 3.6 Promotions Management

> **Where to find it**: there is no "Promotions" entry in the admin sidebar. Coupons are managed
> from **Admin → Settings**, which hosts the coupon section alongside delivery partners, delivery
> regions and delivery fee rules on the same page.

**Coupons**
- Create, edit, activate/deactivate coupons.
- Toggle visibility (visible = shown on storefront; hidden = admin-only use).
- View all redemptions for a coupon.
- Revoke a specific redemption (e.g., if applied incorrectly).

**Global Sale Discounts**
- Create time-limited percentage discounts.
- View all past and future discount windows.
- Delete a discount configuration.
- System prevents overlapping discounts (two cannot be active simultaneously).

---

### 3.7 Review Moderation

Admin can:

- **View all reviews**: Filter by status (Pending, Approved, Rejected) and concern flag.
- **Approve reviews**: Approved reviews appear publicly on the product page.
- **Reject reviews**: Rejected reviews are hidden from all public views.
- **Flag as concern**: Mark a review as having a concern — concern-flagged reviews are hidden from the public even if approved.
- **Delete reviews**: Permanently remove reviews.

---

### 3.8 Delivery Partners

Admin can:

- **Add delivery partners**: Name, code, description, logo, tracking URL pattern.
- **Set fees**: Fixed fee per order for each partner.
- **Toggle active/visible**: Active = available for use; Visible = shown to customers at checkout.
- **View all partners**: List with their current status.

**Fee Rules** — now managed in the admin panel (they were previously database-only):
- District-specific fee (highest priority).
- State-level fee (medium priority).
- Default nationwide fee (lowest priority).
- **Delivery regions**: named groups of states, so a fee can be set per region rather than
  state-by-state.

> **Where to find it**: delivery partners, delivery regions and fee rules all live on the
> **Admin → Settings** page — there is no separate sidebar entry for them.

---

### 3.9 WhatsApp CRM

Admin can send bulk WhatsApp marketing messages using Meta-approved templates. Order and payment
updates are separate — those send automatically and are not managed here.

**Consent is the foundation.** Marketing messages only ever go to people who have opted in.
Customers opt in by accepting the Terms & Conditions / Privacy Policy at registration, and can opt
out at any time from **Notification Preferences** on their profile page, or by replying `STOP` on
WhatsApp. There is no way to message a customer who has not opted in.

**Templates**
Only templates in the `MARKETING` category appear in the campaign picker. Each has a fixed set of
variables approved by Meta, and four of them require a header image (JPEG or PNG, max 5 MB).

**Audiences** — the template determines which audience is allowed:

| Audience | Who it reaches | Used with |
|---|---|---|
| Manual test recipient | One phone number you type in | Any template — always test here first |
| All opted-in customers | Every customer with a recorded WhatsApp opt-in | `new_arrivals_campaign`, `festival_offers` |
| Expo contacts | Event leads imported by phone number, excluding anyone already registered | `expo_outreach`, `expo_outreach_v2` only |

Mixing them is blocked: an expo template cannot be sent to registered customers, and a regular
marketing template cannot be sent to expo leads.

**Expo contacts**
Phone numbers collected at events are pasted in as a batch with a label (e.g. `EXPO_JUN_2026`).
Registered customers and existing contacts are skipped automatically; someone who previously opted
out is re-opted-in only by an explicit re-import.

**Also reaching customers with no phone number**
On the *All opted-in customers* audience there is an option to **also email customers with no phone
number on file**. Ticking it means that pressing Send dispatches the WhatsApp campaign *and* a
matching email — same offer text, image and link — in one action. The two audiences never overlap,
so nobody receives both.

**Sending**
1. **Create Campaign** saves a draft. Nothing is sent.
2. The campaign list shows the exact recipient count — check it before sending.
3. **Send** dispatches, after a confirmation dialog that states whether you are in live or test mode.

Things to know before pressing Send:

- **Sending is one-shot.** Once a campaign finishes it cannot be re-sent, even if some messages
  failed. Recovering failures means creating a new campaign.
- **Test mode does not cover email.** If the "also email" option is ticked, those emails send for
  real even when WhatsApp is in test mode.
- **Large sends look like they failed.** The browser stops waiting after two minutes while the
  server keeps going. Refresh the page rather than pressing Send again.
- The campaign title becomes the **subject line** of the linked email, so it is customer-visible.

**Tracking**
Per-recipient status (Pending, Sent, Delivered, Read, Failed) with the failure reason from Meta.
Delivered and read counts arrive after the fact as WhatsApp reports them back.

---

### 3.10 Email Marketing

The email channel reaches customers the WhatsApp/SMS channel cannot. There is no audience picker:
every campaign goes to **customers with no phone number on file** who have an email address and
have not unsubscribed. Phone is the priority channel; email is the fallback.

- **Create a campaign**: title, subject line, and body. The body supports links and an image.
- **Send**: dispatches to the whole eligible audience, with per-recipient status afterwards.
- Every email carries a one-click unsubscribe link; unsubscribed customers are excluded permanently.

Campaigns created automatically by the "also email" option on a WhatsApp campaign appear in this
list too, titled `<campaign name> (email — no phone on file)`.

---

### 3.11 One-Time Consent Migration

Customers who registered before the WhatsApp CRM existed were never shown an opt-in prompt. The
WhatsApp CRM page has a one-time action that opts them in under the updated Terms & Conditions /
Privacy Policy and emails each one a notice explaining the change — no action required from them,
and they can opt out afterwards like anyone else.

- The page shows how many customers are currently eligible before you run it.
- It only ever touches customers who have never expressed a preference, so it cannot overwrite
  somebody's actual choice and is safe to run more than once.
- Customers with no email address on file are opted in but **cannot be notified**. That count is
  reported after the run.

> **Publish the updated policy text first.** The notice email states an effective date, and
> marketing campaigns to the opted-in audience should not go out before it.

---

### 3.12 Settings & Configuration

Admin can configure global application settings through the Settings page:

| Setting Key | Description |
|---|---|
| `shipping.free_threshold` | Minimum order total (₹) for free shipping |
| `whatsapp.payment_reminder.enabled` | Turn payment reminders on or off |
| `whatsapp.payment_reminder.delay_minutes` | Minutes after checkout before first reminder (default: 30) |
| `whatsapp.cloud.verify_token` | Security token for WhatsApp webhook verification |
| `whatsapp.cloud.access_token` | Meta API access token for WhatsApp sending |

Settings are stored persistently in the database; changes take effect immediately.

---

### 3.13 Homepage & Feature Images

**Carousel / Banner Images**
- Admin uploads images that appear in the homepage hero carousel.
- Images can be reordered and each can have alt text for accessibility.

**Featured Product Images**
- Separate set of images for the featured products section on the homepage.
- Reorderable with alt text.

Both sets are managed via the Settings section of the admin panel.

---

## 4. Automated & Background Features

### Payment Reminder (Abandoned Checkout)

When a customer starts checkout (Razorpay order created) but does not complete payment:

- After **30 minutes** (configurable), the system sends a reminder message.
- A second reminder is sent after **6 hours** if still unpaid.
- Maximum of **2 reminders** per abandoned checkout.
- Reminders are sent via **WhatsApp**, **Email**, and **SMS**. SMS goes out through MSG91 when
  `MSG91_AUTHKEY` is configured; if it is not, the SMS is skipped with a warning and the WhatsApp
  and email reminders still send.
- The reminder contains the customer's name, order reference, payment link, and total amount.
- This feature can be toggled on/off from Settings.

### Back-in-Stock Notifications

When a product is marked as back in stock (admin changes `in_stock` to true):

- All customers who subscribed to that product's "Notify Me" alert receive an email.
- Notifications are sent once; re-subscribing is required for future alerts.

### Tracking Email

When admin updates an order's status to **Dispatched** and enters a tracking number:

- A tracking email is automatically sent to the customer.
- The email contains the courier name, tracking number, and a direct tracking link.

---

## 5. External Services & Integrations

| Service | Purpose | Provider |
|---|---|---|
| Payment Gateway | Online payments for Indian customers | Razorpay |
| International Payments | WhatsApp-coordinated payment for overseas customers | WhatsApp + manual |
| Email Transactional | Order confirmations, OTPs, tracking emails | Resend (production) / Zoho SMTP (development) |
| Email Marketing | Offer campaigns to customers with no phone on file | Resend |
| SMS | Signup / login / password-reset OTPs, and order confirmed / dispatched / delivered updates | MSG91. Sends are skipped with a warning if the auth key is unset |
| WhatsApp Messaging | Payment reminders, marketing campaigns, order updates | Meta WhatsApp Cloud API |
| Image Storage | Product images, category images, review images | CloudFlare R2 |
| Customer Login (Social) | Google Sign-In | Google OAuth2 |
| Analytics / Search | Product and category search | Built-in (PostgreSQL full-text) |

---

## 6. Key Business Rules

### Pricing
- Product base price + option surcharges (e.g., premium colour = +₹100) = line total.
- Global discount (%) applies to all products except those explicitly excluded.
- Coupon discount applied after global discount on eligible items.
- Shipping fee added (free if above threshold).
- GST calculated on taxable amount (rate varies; set per order at time of checkout).
- Grand total = subtotal − discount + shipping + GST.

### Discounts
- Only **one global sale** can be active at a time.
- Coupons can coexist with global sales (applied on top of already-discounted prices).
- Coupon codes are case-insensitive (typically uppercase).
- Per-customer limit prevents abuse (e.g., a customer can use "BBNEW10" only once).

### Orders
- Order public code format: `BB` + 2-digit year + 4-digit sequence (e.g., `BB250001`).
- Shipping address is **snapshotted at time of order** — changes to customer's saved address do not affect past orders.
- GST fields are recorded per order for accounting purposes.
- All order events (status changes, notes, emails sent) are logged with timestamp and actor.

### Reviews
- Only **Approved** reviews appear publicly.
- Reviews with a **concern flag** set by admin are hidden even if approved.
- Both the product page and global reviews page show only Approved + non-concern-flagged reviews.

### Customers
- Email and phone must be unique across all customers.
- Google accounts linked by matching the Google subject ID; if email matches an existing account, the two are linked.
- Customer JWT tokens are long-lived (~5 years) — customers stay logged in across browser sessions.
- Admin JWT tokens expire after 2 hours.

### Images
- All uploaded images are normalised to JPEG format using ImageMagick.
- HEIC images (common on iPhones) are automatically converted.
- Presigned download URLs expire after 15 minutes (images fetched fresh on each page load from secure storage).

---

## 7. Operational Workflows

### Adding a New Product

1. Admin → Products → Create Product (name, price, description).
2. Upload images (set primary image).
3. Add options if applicable (e.g., Color → Red, Blue).
4. Link to one or more categories.
5. Toggle visibility to `true` when ready to publish.
6. Optionally mark as Featured to appear on homepage.

### Processing a New Order

1. Customer places order → Status = **Ordered**.
2. Admin receives notification (email) → Reviews order in admin panel.
3. Admin prepares the arrangement and packages it.
4. Admin → Order → Update Status to **Dispatched** → Enter courier name + tracking number.
5. Customer receives tracking email automatically.
6. Once delivered, admin updates to **Delivered** (or customer confirms).

### Running a Festival Sale

1. Admin → Promotions → Discounts → Create new discount (label, % off, start date, end date).
2. Mark as enabled.
3. Customers automatically see the discount applied at checkout.
4. On end date, the discount expires automatically (no action needed).
5. Optionally exclude specific premium products via Product → Edit → Exclude from global discount.

### Sending a WhatsApp Campaign

1. Admin → **WhatsApp CRM**. Check the header badge: 🔴 Live Mode or 🧪 Dry-run Mode.
2. **Test first.** Create a campaign with audience *Manual test recipient* and your own number.
   Fill in the template fields (header image is required for most marketing templates), create it,
   then send. Confirm the message looks right on your phone.
3. Create the real campaign: same template and content, audience *All opted-in customers*
   (or *Expo contacts* for an expo template). Tick *also email customers with no phone number*
   only if you want the email blast to go out at the same time.
4. **Check the recipient count** on the campaign row before sending — that is exactly how many
   messages will go out.
5. Press **Send** and confirm the dialog. For a large audience the page may show an error after
   two minutes while sending continues in the background — refresh, do not press Send again.
6. Monitor Sent / Failed / Read in the campaign list and the per-recipient view. Delivered and
   read counts fill in over the following minutes as WhatsApp reports back.

**If some messages failed**: the campaign cannot be re-sent. Create a new one for the failures,
and leave the "also email" box unticked so those customers are not emailed twice.

### Running the One-Time Consent Migration

1. Publish the updated Terms & Conditions and Privacy Policy text on the website first.
2. Admin → WhatsApp CRM → *One-time: notify pre-feature customers*. Note the eligible count.
3. Press **Opt in & send notice now** and confirm.
4. Read the result: how many were opted in, how many notice emails failed, and how many had no
   email address (opted in but not notified).
5. Do not send a marketing campaign to the opted-in audience until the effective date stated in
   the notice email has passed.

### Handling a Customer Complaint (Review Issue)

1. Admin → Reviews → Find the review.
2. If content is problematic: Set Concern Flag → review hidden from public.
3. If completely inappropriate: Reject → review hidden; or Delete permanently.
4. Contact customer if needed (via email or WhatsApp, manually).

### Onboarding a New Delivery Partner

1. Admin → Delivery Partners → Create Partner (name, code, logo, tracking URL pattern).
2. Set fixed fee (or configure fee rules in database).
3. Toggle Active = true.
4. Toggle Visible = true to show to customers at checkout.