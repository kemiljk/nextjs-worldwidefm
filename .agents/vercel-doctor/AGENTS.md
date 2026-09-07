# Vercel Doctor

Scans your Next.js codebase for patterns that drive up your Vercel bill, focusing on compute duration, function invocations, and bandwidth optimization.

## Usage

```bash
npx -y vercel-doctor@latest . --verbose --diff
```

## Workflow

Run the scan for changes affecting server execution, data fetching, deployment, or Vercel cost behavior, and for explicit cost reviews. A copy-only or unrelated visual edit does not require it. Focus on findings relevant to the requested scope; verify affected behavior after fixes.
