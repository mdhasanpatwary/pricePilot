---
inclusion: always
---

# Development Workflow Rules

## Planning Mode First

**CRITICAL:** Always run in PLANNING MODE before coding.

### Planning Phase Requirements
1. Produce complete, structured execution plan
2. Define clear deliverables
3. Identify dependencies
4. Estimate complexity
5. Get approval before proceeding

### Planning Deliverables
- High-level system architecture
- Detailed module breakdown
- Database schema design
- API contract definitions
- Integration designs
- Logic specifications
- UI/UX flow diagrams
- MVP scope definition
- Execution roadmap

## Implementation Phase

Only proceed after planning is approved.

### Step-by-Step Execution
- Implement one module at a time
- Test each component before moving forward
- Document as you build
- Commit logical units of work
- Update specs when requirements change

### Code Quality Standards
- TypeScript strict mode
- Comprehensive error handling
- Input validation on all APIs
- Security-first approach
- Performance considerations
- Accessibility compliance

## Testing Requirements

### Unit Tests
- All business logic functions
- API endpoints
- Data transformations
- Validation logic

### Integration Tests
- API workflows
- Database operations
- External API calls
- Queue processing

### E2E Tests
- Critical user flows
- Price update workflows
- Product matching
- Report generation

## Documentation Standards

### Code Documentation
- JSDoc for all public functions
- README for each major module
- API documentation (OpenAPI/Swagger)
- Integration guides

### User Documentation
- Setup guides
- Feature tutorials
- Troubleshooting guides
- FAQ sections

## Version Control

### Commit Messages
- Use conventional commits format
- Reference issue/task numbers
- Clear, descriptive messages

### Branch Strategy
- main: production-ready code
- develop: integration branch
- feature/*: new features
- fix/*: bug fixes
- docs/*: documentation updates

## Deployment

### Pre-Deployment Checklist
- All tests passing
- Documentation updated
- Environment variables documented
- Database migrations tested
- Rollback plan prepared

### Deployment Process
- Staging deployment first
- Smoke tests on staging
- Production deployment
- Post-deployment verification
- Monitor for issues
