# Contributing to Nerimity Confession Bot

Thank you for considering contributing to this project! We welcome contributions of all kinds.

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title** - Summarize the issue concisely
- **Description** - Detailed explanation of the problem
- **Steps to reproduce** - List the exact steps to trigger the bug
- **Expected behavior** - What you expected to happen
- **Actual behavior** - What actually happened
- **Environment** - Node.js version, OS, nerimity.js version
- **Logs** - Relevant console output or error messages

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear title** - Describe the enhancement
- **Provide detailed description** - Explain why this would be useful
- **Include examples** - Show how the feature would work
- **Consider alternatives** - Mention other solutions you've considered

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Make your changes** with clear, descriptive commit messages
3. **Test your changes** thoroughly
4. **Update documentation** if you've changed APIs or added features
5. **Follow the existing code style** - consistency matters
6. **Submit your PR** with a clear description of changes

#### Pull Request Guidelines

- Keep PRs focused on a single concern
- Reference related issues in the PR description
- Include screenshots/videos for UI changes
- Update tests if applicable
- Ensure the bot runs without errors

## Development Setup

1. Fork and clone the repository:
   ```bash
   git clone https://github.com/JoddabodScripts/confession.git
   cd confession
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a test bot on Nerimity for development
4. Copy `.env.example` to `.env` and add your test bot token
5. Make your changes
6. Test thoroughly in a test Nerimity server


## Code Style Guidelines

- Use meaningful variable and function names
- Add comments for complex logic
- Follow the existing code organization (sections with headers)
- Use ES6+ features appropriately
- Keep functions focused and single-purpose

## Database Changes

If your contribution involves changes to the database structure:

- Ensure backward compatibility or provide migration path
- Update documentation for new fields
- Consider data integrity and edge cases
- Test with existing database files

## Privacy & Security

This bot handles potentially sensitive data. When contributing:

- **Never log raw user IDs** - always hash sensitive data
- **Validate all user input** - prevent injection attacks
- **Use secure coding practices** - review the existing privacy patterns
- **Consider abuse scenarios** - think about how features could be misused

## Questions?

Feel free to open an issue with the label `question` if you need clarification on anything.

## Code of Conduct

This project follows a standard code of conduct. Be respectful, inclusive, and constructive in all interactions.

Thank you for contributing! 🎉
