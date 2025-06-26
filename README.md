# Rohlik.cz API Reverse Engineering Project

🎯 **Goal**: Reverse-engineer every customer-facing API call made by **Rohlik.cz** and provide a complete OpenAPI specification with a working mock server.

## 🚀 Quick Start (One Command Setup)

```bash
npm run setup
```

This will:
1. Install all dependencies
2. Build the OpenAPI specification from captured data
3. Validate the specification
4. Start the mock server

## 📦 Project Structure

```
api-convert/
├── docs/
│   └── openapi.yaml           # Generated OpenAPI 3.1 specification
├── server/
│   └── index.ts              # Fastify mock server with realistic stub data
├── scripts/
│   ├── build-spec.ts         # Converts HAR captures to OpenAPI spec
│   ├── validate-spec.ts      # Validates OpenAPI specification
│   ├── captures/             # Network request captures (HAR-like JSON)
│   └── replay/               # Playwright + MCP automation flows
├── logs/
│   └── agent.log            # Progress and debugging logs
└── tests/                   # E2E tests for the mock server
```

## 🛠️ Available Commands

| Command | Description |
|---------|-------------|
| `npm run setup` | **One-command setup** - Install, build spec, validate, and start server |
| `npm run dev` | Start the mock server in development mode |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run build:spec` | Generate OpenAPI spec from captured data |
| `npm run validate:spec` | Validate the OpenAPI specification |
| `npm run capture` | Run Playwright automation to capture API calls |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests against the mock server |

## 🔄 How to Refresh the API Specification

### 1. Capture New API Calls

Run the automated capture process:

```bash
npm run capture
```

This will:
- Open Rohlik.cz in a browser
- Navigate through key user flows (browsing, cart, checkout)
- Capture all network requests to `scripts/captures/`
- Use proper rate limiting (≤ 3 req/s)
- Set User-Agent: `rohlik-research/<commit>`

### 2. Manual Capture (Advanced)

For specific scenarios not covered by automation:

1. Open browser developer tools
2. Navigate to Network tab
3. Perform actions on Rohlik.cz
4. Export HAR file
5. Convert to our JSON format and place in `scripts/captures/`

### 3. Rebuild Specification

After capturing new data:

```bash
npm run build:spec
npm run validate:spec
```

### 4. Restart Mock Server

```bash
npm run dev
```

## 📖 API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:3000/docs
- **Health Check**: http://localhost:3000/health
- **API Root**: http://localhost:3000

## 🔍 Captured Endpoints

The project aims to capture and document these key flows:

### Anonymous Browsing
- ✅ Homepage categories and products
- ✅ Category navigation (`/c{categoryId}-{slug}`)
- ✅ Product search and filtering
- ✅ Product detail pages

### Authentication
- 🔄 Email/SMS login flow
- 🔄 Token exchange and refresh
- 🔄 User profile management

### Shopping Cart
- 🔄 Add/remove items
- 🔄 Update quantities
- 🔄 Apply promo codes
- 🔄 Delivery slot selection

### Checkout & Orders
- 🔄 Address management
- 🔄 Payment methods
- 🔄 Order placement
- 🔄 Order history
- 🔄 Delivery tracking

**Legend**: ✅ Captured | 🔄 In Progress | ❌ Not Yet Captured

## 🧪 Testing

### Run E2E Tests

```bash
npm run test:e2e
```

Tests verify that:
- Mock server responds correctly to all documented endpoints
- Response schemas match the OpenAPI specification
- Authentication flows work as expected
- Cart operations maintain consistency

### Add New Tests

Create test files in `tests/` directory following the existing patterns.

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

```env
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
```

### Rate Limiting

The capture scripts automatically limit requests to ≤ 3 req/s to be respectful to Rohlik's servers.

### User Agent

All requests use: `rohlik-research/<git-commit-hash>`

## 📝 Contributing

### Adding New Capture Scenarios

1. Create a new script in `scripts/replay/`
2. Use MCP browser automation tools
3. Follow the rate limiting guidelines
4. Save captures to `scripts/captures/`
5. Run `npm run build:spec` to update the OpenAPI spec

### Improving Mock Data

Edit the `MockDataGenerator` class in `server/index.ts` to provide more realistic responses based on captured data.

## 🚨 Important Notes

- **No Personal Data**: This project is for interoperability and educational purposes only
- **Rate Limiting**: Always respect Rohlik's servers with appropriate request throttling  
- **Legal Compliance**: Ensure all reverse engineering activities comply with applicable laws and terms of service

## 📊 Current Status

- **Project Created**: ✅
- **Infrastructure Setup**: ✅
- **Mock Server**: ✅
- **OpenAPI Spec Builder**: ✅
- **Validation System**: ✅
- **Anonymous Browsing Capture**: 🔄 In Progress
- **Authentication Flow**: ❌ Pending
- **Cart Operations**: ❌ Pending
- **Checkout Process**: ❌ Pending
- **Order Management**: ❌ Pending

## 🆘 Troubleshooting

### Common Issues

**"OpenAPI spec not found"**
```bash
npm run build:spec
```

**"Port 3000 already in use"**
```bash
PORT=3001 npm run dev
```

**"No captures found"**
```bash
npm run capture
```

**Dependencies issues**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Getting Help

1. Check the logs in `logs/agent.log`
2. Verify the OpenAPI spec with `npm run validate:spec`
3. Test individual endpoints at http://localhost:3000/docs

## 📄 License

MIT License - See LICENSE file for details.

---

**Ready to explore the Rohlik.cz API? Run `npm run setup` and visit http://localhost:3000/docs!** 🚀
