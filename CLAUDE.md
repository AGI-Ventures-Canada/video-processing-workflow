# Claude Code Instructions

## Package Manager

Always use **pnpm** for package management in this project. Do not use npm or yarn.

Examples:
- Install dependencies: `pnpm install`
- Add a package: `pnpm add <package>`
- Add a dev dependency: `pnpm add -D <package>`
- Remove a package: `pnpm remove <package>`
- Run scripts: `pnpm dev`, `pnpm build`, etc.

## Documentation

When dealing with **Next.js** or **Vercel** related questions, issues, or configurations:
- Always use the **Vercel MCP** (Model Context Protocol) to check the official Next.js and Vercel documentation
- This ensures you have access to the most up-to-date and accurate information
- Examples of when to use Vercel MCP:
  - Next.js configuration changes
  - Next.js API updates and breaking changes
  - Vercel deployment settings
  - Next.js best practices and patterns
  - Framework-specific features and capabilities
