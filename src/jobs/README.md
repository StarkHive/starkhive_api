# AI-Powered Job Recommendation System

## Overview

The job recommendation system provides personalized job recommendations for freelancers using machine learning algorithms. It analyzes user behavior, preferences, and job characteristics to generate accurate and relevant job suggestions.

## Features

### Core Functionality
- **Personalized Job Recommendations**: AI-powered scoring based on multiple factors
- **User Behavior Analysis**: Learning from user interactions (views, applications, saves)
- **Performance Tracking**: Comprehensive metrics and analytics
- **Real-time Updates**: Dynamic scoring based on user actions

### ML Algorithms
- **Skill Matching**: TF-IDF and Jaccard similarity for skill matching
- **Experience Level Matching**: Distance-based similarity for experience levels
- **Location Matching**: String similarity and remote work detection
- **Budget Matching**: Range-based scoring for budget preferences
- **User Behavior Scoring**: Historical pattern analysis
- **Job Popularity**: Multi-factor popularity calculation

## Architecture

### Entities

#### Recommendation Entity
```typescript
@Entity('recommendations')
export class Recommendation {
  id: string;
  userId: string;
  jobId: number;
  score: number;
  scoringFactors: {
    skillMatch: number;
    experienceMatch: number;
    locationMatch: number;
    budgetMatch: number;
    userBehavior: number;
    jobPopularity: number;
  };
  userPreferences: {
    skills: string[];
    experienceLevel: string;
    location: string;
    budgetRange: { min: number; max: number };
    jobTypes: string[];
  };
  // Tracking fields
  isViewed: boolean;
  isApplied: boolean;
  isSaved: boolean;
  isDismissed: boolean;
  clickThroughRate: number;
  applicationRate: number;
}
```

### Services

#### RecommendationService
Main service handling recommendation generation and management:

- `generateRecommendations()`: Generate personalized recommendations
- `createRecommendation()`: Create new recommendation with AI scoring
- `updateRecommendationScore()`: Update scores based on new data
- `updateRecommendationAction()`: Track user interactions
- `getRecommendationMetrics()`: Get analytics and performance metrics

### Scoring Algorithm

The recommendation score is calculated using a weighted combination of factors:

```typescript
const weights = {
  skillMatch: 0.25,      // 25% - Skills alignment
  experienceMatch: 0.20, // 20% - Experience level match
  locationMatch: 0.15,   // 15% - Location preferences
  budgetMatch: 0.15,     // 15% - Budget range match
  userBehavior: 0.15,    // 15% - Historical behavior
  jobPopularity: 0.10,   // 10% - Job popularity metrics
};
```

## API Endpoints

### Get Recommendations
```http
GET /jobs/recommendations?limit=20&offset=0&sortBy=score&sortOrder=desc
```

**Query Parameters:**
- `limit`: Number of recommendations (default: 20)
- `offset`: Pagination offset (default: 0)
- `sortBy`: Sort field - 'score', 'createdAt', 'popularity' (default: 'score')
- `sortOrder`: Sort direction - 'asc', 'desc' (default: 'desc')
- `preferences`: User preferences object with validated budget range

**Example Request Body:**
```json
{
  "preferences": {
    "skills": ["javascript", "react", "node.js"],
    "experienceLevel": "mid",
    "location": "remote",
    "budgetRange": {
      "min": 3000,
      "max": 8000
    },
    "jobTypes": ["frontend", "fullstack"]
  }
}
```

**Response:**
```json
[
  {
    "id": "rec-uuid",
    "jobId": 123,
    "score": 0.85,
    "scoringFactors": {
      "skillMatch": 0.8,
      "experienceMatch": 0.7,
      "locationMatch": 0.9,
      "budgetMatch": 0.8,
      "userBehavior": 0.6,
      "jobPopularity": 0.7
    },
    "job": {
      "id": 123,
      "title": "Frontend Developer",
      "description": "React, JavaScript, HTML, CSS",
      "budget": 5000,
      "deadline": "2024-01-15T00:00:00.000Z",
      "status": "OPEN",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "isViewed": false,
    "isApplied": false,
    "isSaved": false,
    "isDismissed": false,
    "clickThroughRate": 0,
    "applicationRate": 0,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Update Recommendation Action
```http
PATCH /jobs/recommendations/:id/action
```

**Request Body:**
```json
{
  "action": "view|apply|save|dismiss",
  "value": true
}
```

### Get Recommendation Metrics
```http
GET /jobs/recommendations/metrics
```

**Response:**
```json
{
  "totalRecommendations": 150,
  "averageScore": 0.72,
  "clickThroughRate": 0.45,
  "applicationRate": 0.12,
  "topSkills": [
    { "skill": "javascript", "count": 25 },
    { "skill": "react", "count": 20 }
  ],
  "topJobTypes": [
    { "type": "frontend", "count": 15 },
    { "type": "fullstack", "count": 12 }
  ],
  "recommendationsByScore": [
    { "scoreRange": "0.8-1.0", "count": 30 },
    { "scoreRange": "0.6-0.8", "count": 45 }
  ]
}
```

## Usage Examples

### Basic Recommendation Generation
```typescript
// Generate recommendations for a user
const recommendations = await recommendationService.generateRecommendations(
  'user-123',
  {
    limit: 10,
    preferences: {
      skills: ['javascript', 'react', 'node.js'],
      experienceLevel: 'mid',
      location: 'remote',
      budgetRange: { 
        min: 3000, 
        max: 8000 
      },
      jobTypes: ['frontend', 'fullstack']
    }
  }
);
```

### Track User Interaction
```typescript
// Mark recommendation as viewed
await recommendationService.updateRecommendationAction(
  'rec-uuid',
  { action: 'view', value: true }
);

// Mark recommendation as applied
await recommendationService.updateRecommendationAction(
  'rec-uuid',
  { action: 'apply', value: true }
);
```

### Get Analytics
```typescript
// Get recommendation performance metrics
const metrics = await recommendationService.getRecommendationMetrics('user-123');
console.log(`CTR: ${metrics.clickThroughRate}`);
console.log(`Application Rate: ${metrics.applicationRate}`);
```

## Performance Considerations

### Database Indexing
The recommendation system uses optimized database indexes:
- `(userId, jobId)` - Unique constraint for user-job pairs
- `(userId, score)` - For sorting by score
- `(userId, createdAt)` - For time-based queries

### Caching Strategy
- Cache user preferences to avoid repeated calculations
- Cache job popularity metrics with TTL
- Use Redis for session-based caching

### Scalability
- Batch processing for recommendation generation
- Background jobs for score updates
- Horizontal scaling for high-traffic scenarios

## Testing

Run the recommendation service tests:
```bash
npm run test src/jobs/tests/recommendation.service.spec.ts
```

### Test Coverage
- Recommendation generation
- Scoring algorithm accuracy
- User interaction tracking
- Performance metrics calculation
- Edge cases and error handling

## Future Enhancements

### Advanced ML Features
- **Collaborative Filtering**: User-based and item-based recommendations
- **Content-Based Filtering**: Advanced NLP for job description analysis
- **Deep Learning**: Neural networks for complex pattern recognition
- **A/B Testing**: Framework for algorithm comparison

### Analytics & Insights
- **Real-time Dashboards**: Live recommendation performance
- **User Segmentation**: Personalized algorithms per user type
- **Predictive Analytics**: Forecast job market trends
- **Recommendation Explanations**: Explain why jobs are recommended

### Integration Features
- **Email Notifications**: Daily/weekly recommendation digests
- **Push Notifications**: Real-time job alerts
- **Social Features**: Share recommendations with network
- **Feedback Loop**: Continuous learning from user feedback

## Contributing

When contributing to the recommendation system:

1. **Follow ML Best Practices**: Document algorithm changes and performance impacts
2. **Add Tests**: Ensure new features are thoroughly tested
3. **Performance Testing**: Validate changes don't impact response times
4. **Documentation**: Update this README with new features
5. **Metrics Tracking**: Add relevant performance metrics

## Troubleshooting

### Common Issues

**Low Recommendation Scores**
- Check user preference data quality
- Verify job data completeness
- Review scoring algorithm weights

**High Memory Usage**
- Implement pagination for large datasets
- Add database query optimization
- Consider caching strategies

**Slow Response Times**
- Review database indexes
- Implement request caching
- Consider async processing for heavy computations

### Monitoring

Key metrics to monitor:
- Recommendation generation time
- User engagement rates (CTR, application rate)
- Database query performance
- Memory and CPU usage
- Error rates and exceptions 