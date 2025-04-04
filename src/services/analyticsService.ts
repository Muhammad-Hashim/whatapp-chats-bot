import { v4 as uuidv4 } from 'uuid';

// Types for analytics data
interface IntentDetection {
  id?: string;
  text: string;
  intentData: any;
  timestamp: number;
}

interface ResponseData {
  id?: string;
  platform: string;
  contentId: string;
  responseId: any;
  intentData: any;
  responseText: string;
  timestamp: number;
  engagement?: EngagementData;
}

interface AdCreationData {
  id?: string;
  platform: string;
  contentId: string;
  adId: string;
  intentData: any;
  timestamp: number;
  performance?: AdPerformanceData;
}

interface AdPerformanceData {
  impressions?: number;
  clicks?: number;
  conversions?: number;
  spend?: number;
  lastUpdated?: number;
}

interface EngagementData {
  clicks?: number;
  replies?: number;
  conversions?: number;
  timestamp?: number;
}

export class AnalyticsService {
  private intentDetections: IntentDetection[] = [];
  private responses: ResponseData[] = [];
  private ads: AdCreationData[] = [];
  
  // In a real implementation, this would connect to a database
  constructor() {
    console.log('Analytics service initialized');
  }

  // Log intent detection
  logIntentDetection(data: IntentDetection) {
    const intentDetection = {
      id: uuidv4(),
      ...data
    };
    this.intentDetections.push(intentDetection);
    console.log(`Intent detection logged: ${intentDetection.id}`);
    return intentDetection.id;
  }

  // Log response sent
  logResponse(data: ResponseData) {
    const response = {
      id: uuidv4(),
      ...data
    };
    this.responses.push(response);
    console.log(`Response logged: ${response.id}`);
    return response.id;
  }

  // Log ad creation
  logAdCreation(data: AdCreationData) {
    const ad = {
      id: uuidv4(),
      ...data
    };
    this.ads.push(ad);
    console.log(`Ad creation logged: ${ad.id} - Ad ID: ${ad.adId}`);
    return ad.id;
  }

  // Update engagement metrics for a response
  updateEngagement(responseId: string, engagement: EngagementData) {
    const response = this.responses.find(r => r.id === responseId);
    if (response) {
      response.engagement = {
        ...response.engagement,
        ...engagement,
        timestamp: Date.now()
      };
      console.log(`Engagement updated for response: ${responseId}`);
    }
  }

  // Update ad performance metrics
  updateAdPerformance(adId: string, performance: AdPerformanceData) {
    const ad = this.ads.find(a => a.adId === adId);
    if (ad) {
      ad.performance = {
        ...ad.performance,
        ...performance,
        lastUpdated: Date.now()
      };
      console.log(`Performance updated for ad: ${adId}`);
    }
  }

  // Get ad performance metrics
  getAdPerformanceMetrics() {
    const totalAds = this.ads.length;
    const adsWithImpressions = this.ads.filter(a => a.performance?.impressions && a.performance.impressions > 0).length;
    
    const totalImpressions = this.ads.reduce(
      (sum, a) => sum + (a.performance?.impressions || 0), 
      0
    );
    
    const totalClicks = this.ads.reduce(
      (sum, a) => sum + (a.performance?.clicks || 0), 
      0
    );
    
    const totalConversions = this.ads.reduce(
      (sum, a) => sum + (a.performance?.conversions || 0), 
      0
    );
    
    const totalSpend = this.ads.reduce(
      (sum, a) => sum + (a.performance?.spend || 0), 
      0
    );
    
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cvr = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
    const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;
    
    return {
      totalAds,
      adsWithImpressions,
      totalImpressions,
      totalClicks,
      totalConversions,
      totalSpend,
      ctr,
      cvr,
      cpa
    };
  }

  // Get performance metrics (including ads)
  getPerformanceMetrics() {
    const totalDetections = this.intentDetections.length;
    const highIntentCount = this.intentDetections.filter(
      d => d.intentData.isHighIntent
    ).length;
    
    const totalResponses = this.responses.length;
    const engagements = this.responses.filter(r => r.engagement).length;
    
    const avgIntentScore = this.intentDetections.reduce(
      (sum, d) => sum + d.intentData.intentScore, 
      0
    ) / (totalDetections || 1);
    
    const adMetrics = this.getAdPerformanceMetrics();
    
    return {
      totalDetections,
      highIntentCount,
      highIntentPercentage: (highIntentCount / totalDetections) * 100,
      avgIntentScore,
      totalResponses,
      engagementRate: (engagements / totalResponses) * 100,
      ads: adMetrics
    };
  }

  // Clear old data (for memory management)
  clearOldData(olderThanDays: number = 30) {
    const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    this.intentDetections = this.intentDetections.filter(
      d => d.timestamp >= cutoff
    );
    
    this.responses = this.responses.filter(
      r => r.timestamp >= cutoff
    );
    
    this.ads = this.ads.filter(
      a => a.timestamp >= cutoff
    );
    
    console.log(`Cleared data older than ${olderThanDays} days`);
  }
}
