# Proxy Simulator UI Component

## Overview

The ProxySimulatorUI component provides a comprehensive interface for testing proxy behaviors and edge-case scenarios in an isolated environment. It allows administrators to configure and run simulations, visualize results, compare multiple simulation runs, and export data.

## Features Implemented

### 1. Scenario Selection UI
- **9 Scenario Types**: Rotation, Failure, Exclusion, Prioritization, Recovery, Cascading Failure, All Fail, Single Success, Intermittent
- **Visual Icons**: Each scenario has a descriptive icon and explanation
- **Dropdown Selection**: Easy-to-use select component with scenario descriptions

### 2. Configuration Form with Validation
- **Required Fields**:
  - Scenario selection (dropdown)
  - Target site URL (text input)
  - Proxy pool (dynamic list with add/remove)
  - Request count (number input, 1-1000)
  
- **Optional Fields**:
  - Failure rate (0-1, shown as percentage)
  - Failure type (timeout, connection_refused, http_error, challenge)
  - Delay between requests (milliseconds)

- **Proxy Pool Management**:
  - Add proxies with URL and type (datacenter/residential)
  - Visual list with badges showing proxy type
  - Remove individual proxies
  - Scrollable list for large proxy pools

- **Form Validation**:
  - Disables submit button until all required fields are valid
  - Real-time validation feedback
  - Clear error messages

### 3. Real-Time Simulation Progress Display
- **Running State**: Shows loading spinner and "Running Simulation..." text
- **Disabled Controls**: Prevents multiple simultaneous simulations
- **Error Handling**: Displays error messages in a prominent card

### 4. Results Visualization with Charts
- **Summary Cards**:
  - Total Requests (with icon)
  - Success Rate (percentage)
  - Failure Rate (percentage)
  - Average Response Time (milliseconds)

- **Request Distribution**:
  - Visual progress bar showing success/failure ratio
  - Color-coded (green for success, red for failure)
  - Numerical breakdown

- **Proxy Usage Distribution**:
  - Shows which proxies were used and how often
  - Progress bars for each proxy
  - Percentage and count display
  - Sorted by usage (most used first)

- **Recommendations Panel**:
  - Displays AI-generated recommendations from the simulator
  - Bullet-point list format
  - Icon indicator

### 5. Comparison View for Multiple Simulations
- **Saved Results**: Automatically loads last 10 simulations
- **Comparison Table**:
  - Scenario name (with badge)
  - Total requests
  - Success rate (color-coded: green ≥80%, yellow ≥50%, red <50%)
  - Average response time
  - Number of proxies used
  
- **Empty State**: Shows helpful message when no simulations exist

### 6. Export Functionality
- **JSON Export**: Downloads simulation results as formatted JSON
- **Filename**: Includes simulation ID for easy identification
- **One-Click Export**: Button in results header

### 7. Additional Features

#### Request Timeline Tab
- **Chronological View**: Shows all requests in order
- **Color-Coded Results**: Green for success, red for failure
- **Request Details**:
  - Request number
  - Proxy used
  - Response time (for successful requests)
  - Error message (for failed requests)
- **Scrollable**: Handles large numbers of requests

#### Tabbed Interface
- **Current Result**: Main visualization and summary
- **Timeline**: Detailed request-by-request view
- **Comparison**: Compare multiple simulation runs

#### Responsive Design
- **Grid Layout**: Adapts to screen size
- **Mobile-Friendly**: Works on tablets and phones
- **Scrollable Areas**: Handles overflow gracefully

## Component Structure

```
ProxySimulatorUI (Main Component)
├── ConfigurationForm
│   ├── Scenario Selection
│   ├── Target Site Input
│   ├── Proxy Pool Manager
│   ├── Request Count Input
│   ├── Optional Fields (Failure Rate, Type, Delay)
│   └── Submit Button
│
├── Results Panel (Tabbed)
│   ├── Current Result Tab
│   │   ├── Summary Cards
│   │   ├── Request Distribution Chart
│   │   ├── Proxy Usage Distribution
│   │   └── Recommendations
│   │
│   ├── Timeline Tab
│   │   └── Request Timeline List
│   │
│   └── Comparison Tab
│       └── Comparison Table
│
└── Error Display
```

## API Integration

### Endpoints Used
1. **POST /api/v1/admin/simulator/run**: Run a new simulation
2. **GET /api/v1/admin/simulator/results**: Load saved simulation results

### Data Flow
1. User configures simulation parameters
2. Form validates input
3. POST request sent to run simulation
4. Results displayed in real-time
5. Results saved to database
6. Results added to comparison list

## Requirements Validated

### Requirement 5.1 - Simulation Isolation
✅ Creates isolated test environment (handled by backend service)
✅ Does not affect production scraping

### Requirement 5.2 - Proxy Rotation Testing
✅ Allows configuration of rotation strategies
✅ Shows which proxy is selected for each request

### Requirement 5.3 - Failure Simulation
✅ Configurable failure rates (0-1)
✅ Multiple failure types supported
✅ Shows affected proxies

### Requirement 5.4 - Proxy Exclusion Testing
✅ Demonstrates exclusion mechanism
✅ Shows skipped proxies in rotation

### Requirement 5.5 - Prioritization Testing
✅ Shows proxy ranking and selection
✅ Displays proxy types (residential vs datacenter)

### Requirement 5.6 - Retry Behavior Testing
✅ Shows retry logic in timeline
✅ Displays backoff delays and proxy switching

### Requirement 5.7 - Edge-Case Scenarios
✅ Supports all 9 edge-case scenarios
✅ Configurable parameters for each scenario

### Requirement 8.1 - Simulation Configuration
✅ Complete configuration interface
✅ All options available (target site, proxy config, challenge scenarios)

### Requirement 8.2 - Simulation Execution
✅ Executes using test configuration
✅ Displays all lifecycle stages in timeline

### Requirement 8.3 - Error Handling
✅ Shows detailed error information
✅ Provides error messages in timeline

### Requirement 8.4 - Simulation Comparison
✅ Side-by-side comparison of results
✅ Comparison table with key metrics

### Requirement 8.5 - Simulation Report
✅ Summary report with performance metrics
✅ Success/failure analysis
✅ Recommendations from simulator

## Usage Example

```typescript
import ProxySimulatorUI from "@/components/admin/proxy-simulator-ui";

// Basic usage
<ProxySimulatorUI />

// With callback
<ProxySimulatorUI 
  onSimulationComplete={(result) => {
    console.log("Simulation completed:", result);
  }}
/>
```

## Styling

- Uses Tailwind CSS for styling
- Follows existing admin component patterns
- Consistent with RealTimeMonitor and LifecycleVisualizer components
- Dark mode compatible
- Accessible color contrasts

## State Management

- Local state using React hooks
- Automatic loading of saved results on mount
- Real-time updates during simulation
- Persistent comparison history (last 10 simulations)

## Error Handling

- Network errors displayed in error card
- Validation errors prevent submission
- User-friendly error messages
- Graceful degradation for missing data

## Performance Considerations

- Scrollable areas for large datasets
- Lazy loading of timeline requests
- Efficient re-renders with proper key usage
- Optimized proxy usage calculations

## Future Enhancements

Potential improvements for future iterations:
1. Real-time progress updates during simulation (WebSocket)
2. Save/load simulation configurations
3. Schedule recurring simulations
4. More detailed charts (line graphs, scatter plots)
5. Export to CSV/PDF formats
6. Simulation history with filtering
7. Comparison of more than 10 simulations
8. Custom scenario builder

## Files Created

1. `components/admin/proxy-simulator-ui.tsx` - Main component
2. `app/admin/simulator/page.tsx` - Admin page wrapper
3. `components/admin/PROXY_SIMULATOR_UI_SUMMARY.md` - This documentation

## Dependencies

- React hooks (useState, useEffect)
- Lucide React icons
- Shadcn UI components (Card, Button, Input, Select, etc.)
- Admin dashboard types from `lib/types/admin-dashboard.ts`
- Existing validation schemas from `lib/validation/schemas.ts`
