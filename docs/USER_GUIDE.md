# User Guide

## 1. Authentication & Roles
- **Register/Login**: Access the application via the web portal at port 80.
- **Admin Access**: Only the exact, case-sensitive username `admin` is granted full administrative privileges. Admins have access to system logs and all users' scans. All other users are restricted to viewing and managing only their own scans.

## 2. Running a Scan
1. Navigate to the **Scans** tab.
2. Click **+ New Scan**.
3. Enter the **Target URL** or upload a Target List.
4. Configure the **LLM Model** (e.g., GPT-4o, Anthropic, DeepSeek).
5. Add any custom instructions and select a **Scan Mode**.
6. Ensure you have provided the required **API keys** in the Settings tab, unless you are using a local Ollama model.
7. Click **Launch Scan**.

## 3. Scheduled & Recurring Scans
- **One-off Scheduled**: You can schedule scans for a future date using the date-picker in the "New Scan" modal.
- **Recurring**: You can set recurrence to **Daily**, **Weekly**, or **Monthly**. 
- Scheduled tasks are executed automatically in the background by the PM2 `strix-scheduler` process. You do not need to keep the browser open.

## 4. Viewing Results & Real-Time Monitoring
- Click on any active or finished scan to open the **Scan Details**.
- Watch the live terminal logs stream via Server-Sent Events in real-time.
- Discovered vulnerabilities are listed on the right side and categorized by severity (High, Medium, Low).
- You can stop a running scan at any time using the stop button.

## 5. Reports & System Logs
- **Exporting**: Export results as PDF reports using the **Download PDF** button from the Scan Details page.
- **System Logs**: (Admin Only) View historical logs for the API and scheduler directly from the web interface.
