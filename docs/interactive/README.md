# KPI Productivity Interactive Documentation

A modern, interactive documentation interface for the KPI Productivity API with live testing capabilities, search functionality, and comprehensive guides.

## Features

- 🚀 **Interactive API Testing** - Test endpoints directly from the documentation
- 🔍 **Advanced Search** - Full-text search across all documentation
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 🎨 **Modern UI** - Clean, intuitive interface with dark mode support
- 📊 **Live Examples** - Real code examples with syntax highlighting
- 🔄 **Auto-Updates** - Documentation stays in sync with API changes
- 📈 **Version History** - Track documentation changes over time

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3002
```

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Documentation Management

### Validation

Validate documentation consistency and format:

```bash
npm run docs:validate
```

### Updates

Update documentation from API routes:

```bash
npm run docs:update
```

### Deployment

Deploy to static hosting:

```bash
npm run docs:deploy
```

## Project Structure

```
docs/interactive/
├── src/
│   ├── components/          # React components
│   │   ├── Layout.tsx       # Main layout component
│   │   ├── SearchBar.tsx    # Search functionality
│   │   ├── CodeBlock.tsx    # Syntax highlighting
│   │   └── APIEndpointCard.tsx # API endpoint display
│   ├── pages/               # Page components
│   │   ├── HomePage.tsx     # Landing page
│   │   ├── APIDocumentationPage.tsx # API reference
│   │   ├── APITestingPage.tsx # Interactive testing
│   │   ├── MonitoringPage.tsx # Monitoring guides
│   │   ├── SecurityPage.tsx # Security documentation
│   │   ├── DeploymentPage.tsx # Deployment guides
│   │   └── SearchPage.tsx   # Search results
│   ├── services/            # API and utility services
│   │   ├── documentationService.ts # Documentation API
│   │   └── apiTestingService.ts # API testing utilities
│   ├── contexts/            # React contexts
│   │   └── DocumentationContext.tsx # Global state
│   └── types/               # TypeScript definitions
├── scripts/                 # Build and deployment scripts
│   ├── deploy.sh           # Deployment script
│   ├── validate.js         # Documentation validation
│   └── update-docs.js      # Auto-update script
└── public/                 # Static assets
```

## API Integration

The documentation interface integrates with the backend API to provide:

- **Live API Documentation** - Generated from route definitions
- **Interactive Testing** - Real API calls with authentication
- **Search Functionality** - Server-side search with fallback
- **Version Management** - Automatic versioning and history

### Backend Endpoints

- `GET /api/documentation` - Complete API documentation
- `GET /api/documentation/sections` - Documentation sections
- `GET /api/documentation/search?q=query` - Search documentation
- `GET /api/documentation/versions` - Version history
- `POST /api/documentation/regenerate` - Regenerate docs (admin)
- `POST /api/documentation/validate` - Validate consistency (admin)

## Configuration

### Environment Variables

Create a `.env` file:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:3001

# Documentation Service
VITE_DOCS_VERSION=1.0.0
```

### Customization

The documentation interface can be customized by:

1. **Theming** - Modify CSS variables in `src/index.css`
2. **Content** - Update markdown files in `../docs/`
3. **Components** - Customize React components in `src/components/`
4. **API Integration** - Modify services in `src/services/`

## Deployment Options

### Static Hosting

The built documentation can be deployed to any static hosting service:

- **Vercel** - `npx vercel --prod`
- **Netlify** - `npx netlify deploy --prod --dir=dist`
- **GitHub Pages** - Automated via GitHub Actions
- **AWS S3** - Upload `dist/` folder to S3 bucket

### Docker

```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### Integration with Main App

The documentation can be integrated into the main application by:

1. Building the documentation: `npm run build`
2. Serving from `/docs` route in the main app
3. Proxying API calls to the backend

## Automation

### GitHub Actions

Automatic documentation updates are handled by `.github/workflows/docs-update.yml`:

- **Triggers** - Code changes, scheduled runs, manual dispatch
- **Validation** - Checks documentation consistency
- **Updates** - Regenerates API documentation
- **Deployment** - Publishes to GitHub Pages

### Scheduled Updates

Documentation is automatically updated:

- **Daily** - Full regeneration and validation
- **On Push** - When API routes change
- **On PR** - Validation checks for pull requests

## Contributing

### Adding New Documentation

1. Create markdown files in appropriate `../docs/` subdirectories
2. Follow the existing format and structure
3. Run validation: `npm run docs:validate`
4. Test the interface: `npm run dev`

### Modifying the Interface

1. Make changes to React components
2. Test locally: `npm run dev`
3. Build and validate: `npm run build`
4. Submit pull request

### API Documentation

API documentation is automatically generated from route definitions. To add new endpoints:

1. Define routes in `backend/src/routes/`
2. Add proper JSDoc comments
3. Run: `npm run docs:update`

## Troubleshooting

### Common Issues

**Build Failures**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

**API Connection Issues**
```bash
# Check backend is running
curl http://localhost:3001/api/health

# Verify environment variables
cat .env
```

**Search Not Working**
```bash
# Regenerate search index
npm run docs:update
```

### Performance

For large documentation sets:

1. **Lazy Loading** - Components are lazy-loaded
2. **Search Optimization** - Uses Fuse.js for fast search
3. **Code Splitting** - Automatic route-based splitting
4. **Caching** - Service worker caches static assets

## License

This documentation interface is part of the KPI Productivity project and follows the same license terms.