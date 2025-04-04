# Facebook Integration Flow

This document explains how the Facebook integration works in our system, from monitoring content to creating targeted ad campaigns.

## Overall Architecture

Our system follows a modular architecture to monitor Facebook, detect high-intent discussions, and create targeted ads:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Facebook    │    │ Intent      │    │ Ad Creation │    │ Analytics   │
│ Crawler     │───▶│ Analyzer    │───▶│ Engine      │───▶│ Tracker     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                  │                  │                  │
       ▼                  ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Facebook Graph API                              │
└─────────────────────────────────────────────────────────────────────┘
```

## Step-by-Step Flow

### 1. Content Monitoring

**Component: FacebookCrawler**

- Monitors specific Facebook pages and groups defined in environment variables
- Uses Facebook Graph API to fetch new posts and comments periodically
- Maintains timestamps of last checked content to avoid processing duplicates
- Emits events when new content is detected

```typescript
// Example: How the crawler finds content
private async checkGroups() {
  for (const groupId of this.groups) {
    // Fetch posts from group
    const posts = await this.fetchGroupPosts(groupId, since);
    
    for (const post of posts) {
      // Emit content event when new posts are found
      this.emit('content', {
        platform: 'facebook',
        type: 'group_post',
        id: post.id,
        text: post.message || '',
        // ...other metadata
      });
      
      // Also check comments
      const comments = await this.fetchPostComments(post.id);
      // Process comments...
    }
  }
}
```

### 2. Intent Analysis

**Component: IntentAnalyzer**

- Receives content from the crawler through the CrawlerManager
- Uses LLM (Mixtral-8x7b) to analyze the text for purchase intent
- Determines intent score, relevant topics, and product relevance
- Decides whether to respond based on intent score threshold

```typescript
// Example: How content is analyzed
async analyzeIntent(text: string) {
  const intentPrompt = await this.intentPromptTemplate.invoke({ text });
  const intentResponse = await this.llm.invoke(intentPrompt);
  
  // Parse the JSON response with intent data
  const intentData = JSON.parse(String(intentResponse.content));
  
  // Log the detection for analytics
  this.analyticsService.logIntentDetection({...});
  
  return intentData;
}
```

### 3. Response Generation

**Component: IntentAnalyzer**

- For high-intent content, generates a personalized response
- Creates conversational, helpful replies that address the user's needs
- Can post replies directly to Facebook posts/comments
- Can trigger ad creation for especially promising opportunities

```typescript
// Example: How responses are generated
async generateResponse(platform: string, content: any, intentData: any) {
  // Generate response using LLM
  const responsePrompt = await this.responsePromptTemplate.invoke({...});
  const responseContent = await this.llm.invoke(responsePrompt);
  
  // Send the response via the messaging service
  await this.messagingService.sendMessage(platform, {...});
  
  // If high intent on Facebook, may create an ad
  if (platform === 'facebook' && intentData.intentScore > 70) {
    await this.facebookCrawler.createMetaAd(intentData, content);
  }
}
```

### 4. Ad Campaign Creation

**Component: FacebookCrawler**

- Creates targeted ad campaigns for high-intent discussions
- Builds custom audience targeting based on the discussion context
- Generates ad creative, headline, and body text
- Sets up campaign budget and bidding strategy
- Supports both automatic and manual campaign creation

```typescript
// Example: Ad creation process
async createMetaAd(intentData, content) {
  // 1. Create ad creative
  const adCreativeId = await this.createAdCreative(intentData, content);
  
  // 2. Define targeting
  const targeting = this.buildTargeting(intentData, content);
  
  // 3. Create campaign
  const campaignId = await this.createCampaign(intentData);
  
  // 4. Create ad set
  const adSetId = await this.createAdSet(campaignId, targeting, intentData);
  
  // 5. Create the actual ad
  const adId = await this.createAd(adSetId, adCreativeId, intentData);
  
  return adId;
}
```

### 5. Performance Tracking

**Component: AnalyticsService**

- Tracks all detected intent scores across platforms
- Monitors response engagement metrics
- Measures ad performance (impressions, clicks, conversions)
- Calculates ROI and optimizes future targeting

## API Endpoints

The system exposes several endpoints to interact with the Facebook integration:

- `GET /api/facebook/trends` - Get trending topics
- `GET /api/facebook/search` - Search for public Facebook content
- `GET /api/facebook/campaigns` - List all ad campaigns
- `GET /api/facebook/campaign/:id/stats` - Get stats for a specific campaign
- `GET /api/facebook/ad/:id/stats` - Get stats for a specific ad

For automatic campaign creation:

- `POST /api/facebook/group-campaign` - Create a campaign targeting a specific group
- `POST /api/facebook/auto-campaign-from-discussion` - Analyze groups and automatically create campaigns for high-intent discussions

## Integration with MCP (Model Context Protocol)

The system can be extended with MCP servers to provide richer context:

- Facebook Data MCP Server - Provides the LLM with detailed Facebook engagement data
- Ad Campaign MCP Server - Allows the LLM to directly manage and optimize campaigns
- Product Catalog MCP Server - Gives the LLM access to your product information

## Configuration

The flow is configured through environment variables:

```
FACEBOOK_TOKEN=your_facebook_api_token
FB_AD_ACCOUNT_ID=your_ad_account_id_without_act_prefix
FB_PAGE_ID=your_page_id
FB_PAGES_TO_MONITOR=page1,page2,page3
FB_GROUPS_TO_MONITOR=group1,group2,group3
```

Adjust these settings to control which pages and groups are monitored.
