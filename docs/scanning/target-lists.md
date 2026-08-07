# Target Lists

While Strix is highly effective at scanning single web applications, enterprise environments often consist of hundreds of subdomains, endpoints, and microservices. Strix supports bulk scanning via **Target Lists**.

## How to use Target Lists

1. Instead of entering a single URL in the "New Scan" modal, click the **Target Type** toggle and switch to **List Upload**.
2. Click the upload area and select a `.txt` file from your local machine.

### File Format Requirements
The `.txt` file must contain a clean, line-separated list of targets. Each line should represent a distinct URL, IP address, or CIDR range.

```txt
https://api.example.com
https://staging.example.com
http://192.168.1.50:8080
10.0.0.0/24
```

## How the Agent Handles Lists
When a Target List is provided, Strix will sequentially (or concurrently, based on internal settings) process each target. The AI agent treats the list as its total "Attack Surface Scope". It will not wander outside of the domains/IPs provided in this list, ensuring that it strictly adheres to your Rules of Engagement.
