# **App Name**: Sikka LMC

## Core Features:

- User Authentication & Access Control: User login, session management, and role-based T-code permissions (SU01) backed by MongoDB.
- T-Code Driven Global Navigation: A global, keyboard-operable command bar at the top of the application for quick T-code based routing to specific modules and pages, replicating SAP's efficient navigation.
- Core Master Data Management: Enable creation, editing, and viewing of essential business entities such as Customers (XD01), Vendors (XK01), and Materials (MM01), with data persisted in MongoDB.
- Procurement Transaction Processing: Functionality to create and manage Purchase Orders (ME21N), including dynamic item lists, quantities, and price tracking, with all data saved to MongoDB.
- Sales & Invoicing Operations: Capability to generate Sales Orders (VA01) and subsequent Invoices (VF01) for customers, ensuring comprehensive recording of sales data and statuses in MongoDB.
- Financial Payment Management: Tools for recording both Incoming Payments (F28) from customers and Outgoing Payments (F110) to vendors, ensuring accurate and up-to-date financial records in MongoDB.
- Dashboard & Reporting: A centralized dashboard (DB01) presenting key financial summaries and transaction listings dynamically sourced from MongoDB.

## Style Guidelines:

- Primary Color: A professional and trustworthy medium-dark blue (#2A6BD5), symbolizing reliability and clarity for the application's core actions and branding.
- Background Color: A very light, subtle blue-grey (#F1F5FC) to ensure a clean, modern, and uncluttered interface that provides a neutral canvas for data presentation.
- Accent Color: A clear, bright sky blue (#6CD1F3) used sparingly to highlight interactive elements, emphasize focus, and draw attention to important information, providing good contrast against the primary and background colors.
- Body and Headline Font: 'Inter', a grotesque sans-serif font, selected for its modern, neutral, and highly readable characteristics, which ensures optimal clarity for financial and accounting data across all screen sizes.
- Adopt a clean, line-based icon style. Implement action-specific icons for 'Execute' (🚀 Green) and 'Cancel' (❌ Red) buttons, and semantically relevant icons for navigation and data entry fields to enhance quick comprehension.
- Utilize a mobile-first, card-based layout featuring soft shadows and rounded corners (rounded-2xl, shadow-md) for clear content separation and a modern aesthetic. A sticky T-code command bar in the header will ensure constant accessibility.
- Integrate subtle animations for UI feedback, particularly on form element focus (e.g., a distinct blue border), button interactions (e.g., highlighting F8 'Execute' button in green), and seamless route transitions, to support the application's keyboard-driven workflow.
