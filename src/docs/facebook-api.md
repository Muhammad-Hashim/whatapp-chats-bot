# Facebook API Documentation

This document outlines the available Facebook API methods for retrieving public data and campaign statistics.

## Environment Variables Required

```
FACEBOOK_TOKEN=your_facebook_api_token
FB_AD_ACCOUNT_ID=your_ad_account_id_without_act_prefix
FB_PAGE_ID=your_page_id
FB_PAGES_TO_MONITOR=page1,page2,page3
FB_GROUPS_TO_MONITOR=group1,group2,group3
```

## Public Data API Endpoints

### Get Trending Topics
```
GET /api/facebook/trends?placeId={placeId}
```
- `placeId`: Facebook place ID (default: 107852219231636 for USA)

### Search Public Content
```
GET /api/facebook/search?q={query}&type={type}&limit={limit}
```
- `q`: Search query (required)
- `type`: Content type to search for (page, event, group) (default: page)
- `limit`: Number of results to return (default: 25)

## Campaign Statistics API Endpoints

### Get All Campaigns
```
GET /api/facebook/campaigns
```
Returns all campaigns for the configured ad account.

### Get Campaign Statistics
```
GET /api/facebook/campaign/{campaignId}/stats?datePreset={datePreset}
```
- `campaignId`: Facebook campaign ID (required)
- `datePreset`: Date range preset (today, yesterday, last_7_days, last_30_days) (default: last_7_days)

### Get Ad Statistics
```
GET /api/facebook/ad/{adId}/stats?datePreset={datePreset}
```
- `adId`: Facebook ad ID (required)
- `datePreset`: Date range preset (today, yesterday, last_7_days, last_30_days) (default: last_7_days)

## FacebookCrawler Class Methods

### Public Data Methods

- `getPublicPageData(pageUsername)`: Get public page information
- `getPublicPostsByHashtag(hashtag, limit)`: Get public posts by hashtag
- `getTrendingTopics(placeId)`: Get trending topics in a location
- `searchPublicContent(query, type, limit)`: Search for public content

### Campaign Statistics Methods

- `getCampaignStats(campaignId, metrics, datePreset)`: Get campaign statistics
- `getAdSetStats(adSetId, metrics, datePreset)`: Get ad set statistics
- `getAdStats(adId, metrics, datePreset)`: Get ad statistics
- `getAllCampaigns()`: Get all campaigns for the ad account
- `startAdPerformanceTracking(intervalMinutes)`: Start auto-tracking ad performance
- `stopAdPerformanceTracking()`: Stop auto-tracking ad performance
