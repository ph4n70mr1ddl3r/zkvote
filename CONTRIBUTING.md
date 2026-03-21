# Contributing to ZKVOTE

Thank you for your interest in contributing to ZKVOTE! This document provides guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- Node.js >= 18
- Rust and Cargo (for Circom)
- Circom >= 2.0.0

### Installation

1. Fork and clone the repository
2. Install dependencies:
    ```bash
    npm install
    ```
3. Install Circom (see README.md for detailed instructions)

### Initial Setup

```bash
npm run generate-accounts
npm run build-tree
npm run compile-circuits
```

## Development Workflow

### Code Style

We use ESLint and Prettier to maintain code quality:

```bash
npm run lint          # Check for linting issues
npm run lint:fix      # Auto-fix linting issues
npm run format        # Format code with Prettier
npm run format:check  # Check formatting
```

### Testing

Always run tests before submitting a PR:

```bash
npm test
```

Or run individual test suites:

```bash
npm run test:valid
npm run test:invalid
npm run test:nullifier
npm run test:double-vote
```

### Commit Messages

- Use clear, descriptive commit messages
- Reference issues when applicable
- Follow conventional commits format when possible:
    - `feat: add new feature`
    - `fix: resolve bug`
    - `docs: update documentation`
    - `refactor: improve code structure`
    - `test: add tests`

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all tests pass
4. Ensure linting passes
5. Update documentation if needed
6. Submit a pull request

### PR Checklist

- [ ] Code follows the project's style guidelines
- [ ] All tests pass
- [ ] Linting passes
- [ ] Documentation updated if needed
- [ ] Security considerations addressed

## Security Considerations

When contributing, please be aware of:

- **Private keys**: Never commit files containing private keys
- **Input validation**: All user inputs should be validated
- **Circuit changes**: Changes to circuits require careful review
- **Dependencies**: Review dependency updates for security issues

See SECURITY.md for more details.

## Project Structure

```
zkvote/
├── circuits/          # Circom ZK circuits
├── scripts/           # CLI scripts
├── tests/             # Test suite
├── utils/             # Utility modules
├── data/              # Runtime data (gitignored)
└── build/             # Compiled artifacts (gitignored)
```

## Questions?

Feel free to open an issue for questions or discussions.
