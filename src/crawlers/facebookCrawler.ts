import { EventEmitter } from 'events';

export class FacebookCrawler extends EventEmitter {
  private pages: string[] = [];
  private groups: string[] = [];
  private pollingInterval: number = 300000; // 5 minutes
  private timer: NodeJS.Timeout | null = null;
  private lastChecked: Record<string, number> = {};
  private fbToken: string;
  private adStatsTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.fbToken = process.env.FACEBOOK_TOKEN || '';
  }

  // Add Facebook pages to monitor
  addPages(pageIds: string[]) {
    this.pages = [...new Set([...this.pages, ...pageIds])];
    
    // Initialize last checked time
    for (const pageId of pageIds) {
      if (!this.lastChecked[`page_${pageId}`]) {
        this.lastChecked[`page_${pageId}`] = Date.now();
      }
    }
  }

  // Add Facebook groups to monitor
  addGroups(groupIds: string[]) {
    this.groups = [...new Set([...this.groups, ...groupIds])];
    
    // Initialize last checked time
    for (const groupId of groupIds) {
      if (!this.lastChecked[`group_${groupId}`]) {
        this.lastChecked[`group_${groupId}`] = Date.now();
      }
    }
  }

  // Register callback for when content is found
  onContentFound(callback: (content: any) => Promise<void>) {
    this.on('content', callback);
  }

  // Start the crawler
  async start() {
    if (this.timer) {
      clearInterval(this.timer);
    }

    // Immediately perform first check
    await this.checkAll();

    // Set up recurring checks
    this.timer = setInterval(async () => {
      await this.checkAll();
    }, this.pollingInterval);

    console.log('Facebook crawler started');
  }

  // Stop the crawler
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('Facebook crawler stopped');
  }

  // Check all pages and groups
  private async checkAll() {
    await Promise.all([
      this.checkPages(),
      this.checkGroups()
    ]);
  }

  // Check pages for new posts and comments
  private async checkPages() {
    try {
      for (const pageId of this.pages) {
        const lastCheckedKey = `page_${pageId}`;
        const since = Math.floor(this.lastChecked[lastCheckedKey] / 1000);
        
        // Fetch posts from page
        const posts = await this.fetchPagePosts(pageId, since);
        
        for (const post of posts) {
          this.emit('content', {
            platform: 'facebook',
            type: 'post',
            id: post.id,
            text: post.message || '',
            pageId: pageId,
            url: `https://facebook.com/${post.id}`,
            author: post.from?.name || 'Unknown',
            created: new Date(post.created_time).getTime(),
            metadata: post
          });

          // Fetch comments on this post
          const comments = await this.fetchPostComments(post.id);
          for (const comment of comments) {
            const commentTime = new Date(comment.created_time).getTime();
            if (commentTime > this.lastChecked[lastCheckedKey]) {
              this.emit('content', {
                platform: 'facebook',
                type: 'comment',
                id: comment.id,
                text: comment.message || '',
                pageId: pageId,
                postId: post.id,
                url: `https://facebook.com/${comment.id}`,
                author: comment.from?.name || 'Unknown',
                created: commentTime,
                metadata: comment
              });
            }
          }
        }

        // Update last checked time
        this.lastChecked[lastCheckedKey] = Date.now();
      }
    } catch (error) {
      console.error('Error checking Facebook pages:', error);
    }
  }

  // Check groups for new posts and comments
  private async checkGroups() {
    try {
      for (const groupId of this.groups) {
        const lastCheckedKey = `group_${groupId}`;
        const since = Math.floor(this.lastChecked[lastCheckedKey] / 1000);
        
        // Fetch posts from group
        const posts = await this.fetchGroupPosts(groupId, since);
        
        for (const post of posts) {
          this.emit('content', {
            platform: 'facebook',
            type: 'group_post',
            id: post.id,
            text: post.message || '',
            groupId: groupId,
            url: `https://facebook.com/groups/${groupId}/posts/${post.id}`,
            author: post.from?.name || 'Unknown',
            created: new Date(post.created_time).getTime(),
            metadata: post
          });

          // Fetch comments on this post
          const comments = await this.fetchPostComments(post.id);
          for (const comment of comments) {
            const commentTime = new Date(comment.created_time).getTime();
            if (commentTime > this.lastChecked[lastCheckedKey]) {
              this.emit('content', {
                platform: 'facebook',
                type: 'group_comment',
                id: comment.id,
                text: comment.message || '',
                groupId: groupId,
                postId: post.id,
                url: `https://facebook.com/${comment.id}`,
                author: comment.from?.name || 'Unknown',
                created: commentTime,
                metadata: comment
              });
            }
          }
        }

        // Update last checked time
        this.lastChecked[lastCheckedKey] = Date.now();
      }
    } catch (error) {
      console.error('Error checking Facebook groups:', error);
    }
  }

  // Fetch posts from a Facebook page
  private async fetchPagePosts(pageId: string, since: number) {
    const url = `https://graph.facebook.com/v17.0/${pageId}/feed?fields=id,message,created_time,from&since=${since}&limit=25`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.fbToken}`
        }
      });

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error(`Error fetching posts from page ${pageId}:`, error);
      return [];
    }
  }

  // Fetch posts from a Facebook group
  private async fetchGroupPosts(groupId: string, since: number) {
    const url = `https://graph.facebook.com/v17.0/${groupId}/feed?fields=id,message,created_time,from&since=${since}&limit=25`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.fbToken}`
        }
      });

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error(`Error fetching posts from group ${groupId}:`, error);
      return [];
    }
  }

  // Fetch comments from a post
  private async fetchPostComments(postId: string) {
    const url = `https://graph.facebook.com/v17.0/${postId}/comments?fields=id,message,created_time,from&limit=50`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.fbToken}`
        }
      });

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error(`Error fetching comments for post ${postId}:`, error);
      return [];
    }
  }

  // Create a Facebook ad based on detected high-intent content
  async createMetaAd(intentData: any, content: any) {
    const adAccountId = process.env.FB_AD_ACCOUNT_ID;
    const url = `https://graph.facebook.com/v17.0/act_${adAccountId}/ads`;
    
    try {
      // Create ad creative based on intent
      const adCreativeId = await this.createAdCreative(intentData, content);
      
      // Define targeting based on content and intent
      const targeting = this.buildTargeting(intentData, content);
      
      // Define campaign objectives and budget
      const campaignData = {
        name: `Auto_Intent_${new Date().toISOString().slice(0,10)}_${intentData.topics[0] || 'General'}`,
        objective: 'CONVERSIONS',
        status: 'ACTIVE',
        special_ad_categories: []
      };
      
      // Create campaign
      const campaignResponse = await fetch(`https://graph.facebook.com/v17.0/act_${adAccountId}/campaigns`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.fbToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(campaignData)
      });
      
      const campaignData2 = await campaignResponse.json();
      const campaignId = campaignData2.id;
      
      // Create ad set
      const adSetData = {
        name: `AdSet_${intentData.topics[0] || 'General'}_${intentData.intentScore}`,
        campaign_id: campaignId,
        daily_budget: 5000, // $50.00 in cents
        targeting: targeting,
        optimization_goal: 'CONVERSIONS',
        billing_event: 'IMPRESSIONS',
        bid_amount: 500, // $5.00 in cents
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        status: 'ACTIVE'
      };
      
      const adSetResponse = await fetch(`https://graph.facebook.com/v17.0/act_${adAccountId}/adsets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.fbToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(adSetData)
      });
      
      const adSetData2 = await adSetResponse.json();
      const adSetId = adSetData2.id;
      
      // Create ad
      const adData = {
        name: `Ad_${intentData.topics[0] || 'General'}_${new Date().toISOString().slice(0,10)}`,
        adset_id: adSetId,
        creative: {
          creative_id: adCreativeId
        },
        status: 'ACTIVE'
      };
      
      const adResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.fbToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(adData)
      });
      
      const adData2 = await adResponse.json();
      console.log('Meta Ad created:', adData2);
      
      return adData2.id;
    } catch (error) {
      console.error('Error creating Meta Ad:', error);
      return null;
    }
  }
  
  // Create ad creative based on intent data
  private async createAdCreative(intentData: any, content: any) {
    const adAccountId = process.env.FB_AD_ACCOUNT_ID;
    const pageId = process.env.FB_PAGE_ID;
    const url = `https://graph.facebook.com/v17.0/act_${adAccountId}/adcreatives`;
    
    // Generate ad copy based on intent data
    const headline = this.generateHeadline(intentData);
    const body = this.generateAdBody(intentData, content);
    
    // Get appropriate product image URL based on intent
    const imageUrl = this.getProductImageUrl(intentData.relevantProducts[0] || 'default');
    
    try {
      const creativeData = {
        name: `Creative_${intentData.topics[0] || 'General'}_${new Date().toISOString().slice(0,10)}`,
        object_story_spec: {
          page_id: pageId,
          link_data: {
            message: body,
            link: process.env.WEBSITE_URL || 'https://example.com',
            name: headline,
            image_url: imageUrl,
            call_to_action: {
              type: 'LEARN_MORE'
            }
          }
        }
      };
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.fbToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(creativeData)
      });
      
      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error('Error creating ad creative:', error);
      throw error;
    }
  }
  
  // Build targeting based on intent data
  private buildTargeting(intentData: any, content: any) {
    // Basic targeting template
    return {
      age_min: 18,
      age_max: 65,
      genders: [1, 2], // All genders
      geo_locations: {
        countries: ['US']
      },
      interests: this.mapTopicsToInterests(intentData.topics),
      flexible_spec: [{
        interests: this.mapProductsToInterests(intentData.relevantProducts)
      }]
    };
  }
  
  // Map topics to Facebook interest IDs
  private mapTopicsToInterests(topics: string[]) {
    // This would normally be a more comprehensive mapping
    const interestMap: Record<string, string> = {
      'smartphones': '6003015842842',
      'earbuds': '6003139266461',
      'audio': '6003139266461',
      'laptops': '6002970401671',
      'gaming': '6003010455011',
      'electronics': '6002964301001'
    };
    
    return topics.map(topic => {
      const lowercaseTopic = topic.toLowerCase();
      for (const [key, value] of Object.entries(interestMap)) {
        if (lowercaseTopic.includes(key)) {
          return { id: value, name: key };
        }
      }
      return null;
    }).filter(Boolean);
  }
  
  // Map products to Facebook interest IDs
  private mapProductsToInterests(products: string[]) {
    // This would be product-specific in a real implementation
    const productMap: Record<string, string> = {
      'Smartphone X1': '6003015842842',
      'Wireless Earbuds Pro': '6003139266461',
      'Gaming Laptop Z5': '6002970401671'
    };
    
    return products.map(product => {
      if (productMap[product]) {
        return { id: productMap[product], name: product };
      }
      return null;
    }).filter(Boolean);
  }
  
  // Generate headline based on intent
  private generateHeadline(intentData: any): string {
    // Simple headline generator, could be more sophisticated
    if (intentData.urgency === 'high') {
      return `Solve Your ${intentData.topics[0] || 'Tech'} Problem Today!`;
    } else if (intentData.relevantProducts.length > 0) {
      return `Discover the Perfect ${intentData.relevantProducts[0]}`;
    } else {
      return `The Solution You've Been Looking For`;
    }
  }
  
  // Generate ad body based on intent and content
  private generateAdBody(intentData: any, content: any): string {
    // Simple body generator, could use LLM in real implementation
    let body = `We noticed you're having an issue with ${intentData.topics[0] || 'your device'}. `;
    
    if (intentData.relevantProducts.length > 0) {
      body += `Our ${intentData.relevantProducts[0]} is designed to solve exactly this problem. `;
    }
    
    body += `Check out our solutions that have helped thousands of customers like you!`;
    
    return body;
  }
  
  // Get product image URL
  private getProductImageUrl(productName: string): string {
    // This would be a lookup to your product image library
    const defaultImage = 'https://example.com/images/default-product.jpg';
    
    const imageMap: Record<string, string> = {
      'Smartphone X1': 'https://example.com/images/smartphone-x1.jpg',
      'Wireless Earbuds Pro': 'https://example.com/images/earbuds-pro.jpg',
      'Gaming Laptop Z5': 'https://example.com/images/laptop-z5.jpg',
      'default': defaultImage
    };
    
    return imageMap[productName] || defaultImage;
  }

  // FACEBOOK PUBLIC DATA METHODS

  /**
   * Get public page information and posts
   * @param pageUsername Public page username
   */
  async getPublicPageData(pageUsername: string) {
    const url = `https://graph.facebook.com/v17.0/${pageUsername}?fields=id,name,about,category,fan_count,verification_status,location`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.fbToken}`
        }
      });

      const data = await response.json();
      console.log(`Retrieved public data for page: ${pageUsername}`);
      return data;
    } catch (error) {
      console.error(`Error fetching public page data for ${pageUsername}:`, error);
      return null;
    }
  }

  /**
   * Get public posts by hashtag (requires special permissions)
   * @param hashtag Hashtag to search for (without the # symbol)
   * @param limit Number of results to return
   */
  async getPublicPostsByHashtag(hashtag: string, limit: number = 25) {
    // Note: This endpoint requires Instagram Graph API permissions
    const url = `https://graph.facebook.com/v17.0/ig_hashtag_search?user_id=${process.env.FB_PAGE_ID}&q=${hashtag}`;
    
    try {
      // First, get the hashtag ID
      const hashtagResponse = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.fbToken}`
        }
      });

      const hashtagData = await hashtagResponse.json();
      if (!hashtagData.data || hashtagData.data.length === 0) {
        throw new Error('Hashtag not found');
      }

      const hashtagId = hashtagData.data[0].id;
      
      // Then get recent media with this hashtag
      const mediaUrl = `https://graph.facebook.com/v17.0/${hashtagId}/recent_media?user_id=${process.env.FB_PAGE_ID}&limit=${limit}`;
      const mediaResponse = await fetch(mediaUrl, {
        headers: {
          'Authorization': `Bearer ${this.fbToken}`
        }
      });

      const mediaData = await mediaResponse.json();
      console.log(`Retrieved ${mediaData.data?.length || 0} posts with hashtag #${hashtag}`);
      return mediaData.data || [];
    } catch (error) {
      console.error(`Error fetching posts with hashtag #${hashtag}:`, error);
      return [];
    }
  }

  /**
   * Get trending topics in a specific location
   * Note: This is a deprecated feature but included for reference
   * @param placeId Facebook place ID
   */
  async getTrendingTopics(placeId: string = '107852219231636') { // Default is USA
    const url = `https://graph.facebook.com/v17.0/${placeId}/trending`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.fbToken}`
        }
      });

      const data = await response.json();
      console.log(`Retrieved trending topics for place ID: ${placeId}`);
      return data.data || [];
    } catch (error) {
      console.error(`Error fetching trending topics for place ID ${placeId}:`, error);
      return [];
    }
  }

  /**
   * Search for public Facebook content
   * @param query Search query
   * @param type Content type to search for
   * @param limit Number of results to return
   */
  async searchPublicContent(query: string, type: 'page' | 'event' | 'group' = 'page', limit: number = 25) {
    const url = `https://graph.facebook.com/v17.0/search?q=${encodeURIComponent(query)}&type=${type}&limit=${limit}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.fbToken}`
        }
      });

      const data = await response.json();
      console.log(`Found ${data.data?.length || 0} ${type}s matching "${query}"`);
      return data.data || [];
    } catch (error) {
      console.error(`Error searching for ${type}s with query "${query}":`, error);
      return [];
    }
  }

  // AD CAMPAIGN STATISTICS METHODS

  /**
   * Get campaign statistics
   * @param campaignId Facebook campaign ID
   * @param metrics Metrics to retrieve
   * @param datePreset Date range preset or custom date range
   */
  async getCampaignStats(
    campaignId: string, 
    metrics: string[] = ['impressions', 'clicks', 'spend', 'actions'],
    datePreset: string = 'last_7_days'
  ) {
    const fields = [
      'campaign_name',
      'objective',
      'status',
      ...metrics
    ].join(',');
    
    const url = `https://graph.facebook.com/v17.0/${campaignId}/insights?fields=${fields}&date_preset=${datePreset}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.fbToken}`
        }
      });

      const data = await response.json();
      console.log(`Retrieved campaign statistics for campaign: ${campaignId}`);
      
      // If we have stats data, log it to our analytics service
      if (data.data && data.data.length > 0) {
        const statsData = data.data[0];
        this.trackAdPerformance(campaignId, statsData);
      }
      
      return data.data || [];
    } catch (error) {
      console.error(`Error fetching campaign statistics for ${campaignId}:`, error);
      return [];
    }
  }

  /**
   * Get ad set statistics
   * @param adSetId Facebook ad set ID
   * @param metrics Metrics to retrieve
   * @param datePreset Date range preset or custom date range
   */
  async getAdSetStats(
    adSetId: string, 
    metrics: string[] = ['impressions', 'clicks', 'spend', 'actions'],
    datePreset: string = 'last_7_days'
  ) {
    const fields = [
      'adset_name',
      'optimization_goal',
      'billing_event',
      'bid_amount',
      'targeting',
      ...metrics
    ].join(',');
    
    const url = `https://graph.facebook.com/v17.0/${adSetId}/insights?fields=${fields}&date_preset=${datePreset}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.fbToken}`
        }
      });

      const data = await response.json();
      console.log(`Retrieved ad set statistics for ad set: ${adSetId}`);
      return data.data || [];
    } catch (error) {
      console.error(`Error fetching ad set statistics for ${adSetId}:`, error);
      return [];
    }
  }

  /**
   * Get ad statistics
   * @param adId Facebook ad ID
   * @param metrics Metrics to retrieve
   * @param datePreset Date range preset or custom date range
   */
  async getAdStats(
    adId: string, 
    metrics: string[] = ['impressions', 'clicks', 'spend', 'actions'],
    datePreset: string = 'last_7_days'
  ) {
    const fields = [
      'ad_name',
      'status',
      'created_time',
      ...metrics
    ].join(',');
    
    const url = `https://graph.facebook.com/v17.0/${adId}/insights?fields=${fields}&date_preset=${datePreset}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.fbToken}`
        }
      });

      const data = await response.json();
      console.log(`Retrieved ad statistics for ad: ${adId}`);
      
      // Track this individual ad's performance in analytics
      if (data.data && data.data.length > 0) {
        const adData = data.data[0];
        this.trackAdPerformance(adId, adData);
      }
      
      return data.data || [];
    } catch (error) {
      console.error(`Error fetching ad statistics for ${adId}:`, error);
      return [];
    }
  }

  /**
   * Track ad performance in analytics
   * @param adId Ad ID
   * @param statsData Statistics data from Facebook
   */
  private async trackAdPerformance(adId: string, statsData: any) {
    try {
      // Get analytics service from the global scope
      const analyticsService = (global as any).analyticsService;
      
      if (!analyticsService) {
        console.error('Analytics service not found in global scope');
        return;
      }
      
      // Extract performance metrics
      const performance = {
        impressions: parseInt(statsData.impressions || 0),
        clicks: parseInt(statsData.clicks || 0),
        spend: parseFloat(statsData.spend || 0),
        conversions: this.extractConversions(statsData.actions || []),
        lastUpdated: Date.now()
      };
      
      // Update performance in analytics
      analyticsService.updateAdPerformance(adId, performance);
      console.log(`Tracked performance for ad ${adId}`);
    } catch (error) {
      console.error(`Error tracking ad performance for ${adId}:`, error);
    }
  }

  /**
   * Extract conversions from actions array
   * @param actions Facebook actions array
   */
  private extractConversions(actions: any[]): number {
    if (!Array.isArray(actions)) return 0;
    
    // Find purchase or conversion actions
    const conversionActions = actions.filter(
      action => action.action_type === 'purchase' || 
                action.action_type === 'offsite_conversion'
    );
    
    // Sum up the values
    return conversionActions.reduce(
      (sum, action) => sum + parseInt(action.value || 0), 
      0
    );
  }

  /**
   * Get all campaigns for the ad account
   */
  async getAllCampaigns() {
    const adAccountId = process.env.FB_AD_ACCOUNT_ID;
    const url = `https://graph.facebook.com/v17.0/act_${adAccountId}/campaigns?fields=id,name,objective,status,created_time,updated_time`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.fbToken}`
        }
      });

      const data = await response.json();
      console.log(`Retrieved ${data.data?.length || 0} campaigns`);
      return data.data || [];
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      return [];
    }
  }

  /**
   * Schedule regular updates of ad performance
   * @param intervalMinutes Minutes between updates
   */
  startAdPerformanceTracking(intervalMinutes: number = 60) {
    // Clear any existing timer
    if (this.adStatsTimer) {
      clearInterval(this.adStatsTimer);
    }
    
    // Set up recurring checks
    this.adStatsTimer = setInterval(async () => {
      await this.updateAllAdPerformance();
    }, intervalMinutes * 60 * 1000);
    
    console.log(`Ad performance tracking started, updating every ${intervalMinutes} minutes`);
    
    // Run initial update
    this.updateAllAdPerformance();
  }

  /**
   * Update performance for all ads
   */
  private async updateAllAdPerformance() {
    try {
      const campaigns = await this.getAllCampaigns();
      
      for (const campaign of campaigns) {
        // Skip inactive campaigns
        if (campaign.status !== 'ACTIVE') continue;
        
        // Get campaign stats
        await this.getCampaignStats(campaign.id);
        
        // Get ads in this campaign
        const ads = await this.getAdsInCampaign(campaign.id);
        
        for (const ad of ads) {
          // Skip inactive ads
          if (ad.status !== 'ACTIVE') continue;
          
          // Get ad stats
          await this.getAdStats(ad.id);
        }
      }
      
      console.log('Updated performance for all active ads');
    } catch (error) {
      console.error('Error updating ad performance:', error);
    }
  }

  /**
   * Get all ads in a campaign
   * @param campaignId Campaign ID
   */
  private async getAdsInCampaign(campaignId: string) {
    const url = `https://graph.facebook.com/v17.0/${campaignId}/ads?fields=id,name,status,created_time`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.fbToken}`
        }
      });

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error(`Error fetching ads for campaign ${campaignId}:`, error);
      return [];
    }
  }

  // Stop ad performance tracking
  stopAdPerformanceTracking() {
    if (this.adStatsTimer) {
      clearInterval(this.adStatsTimer);
      this.adStatsTimer = null;
    }
    console.log('Ad performance tracking stopped');
  }
}
