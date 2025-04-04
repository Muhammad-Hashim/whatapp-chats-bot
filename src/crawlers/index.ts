import { RedditCrawler } from './redditCrawler';
import { DiscordCrawler } from './discordCrawler';
import { FacebookCrawler } from './facebookCrawler';

// Crawler Manager
export class CrawlerManager {
  private redditCrawler: RedditCrawler;
  private discordCrawler: DiscordCrawler;
  private facebookCrawler: FacebookCrawler;
  private intentAnalyzer: any; // Will be set from main application
  
  constructor() {
    this.redditCrawler = new RedditCrawler();
    this.discordCrawler = new DiscordCrawler();
    this.facebookCrawler = new FacebookCrawler();
  }

  setIntentAnalyzer(analyzer: any) {
    this.intentAnalyzer = analyzer;
  }

  // Start all crawlers
  async startAll() {
    await Promise.all([
      this.startRedditCrawler(),
      this.startDiscordCrawler(),
      this.startFacebookCrawler()
    ]);
  }

  // Start individual crawlers
  async startRedditCrawler() {
    this.redditCrawler.onContentFound(async (content: any) => {
      await this.processContent('reddit', content);
    });
    await this.redditCrawler.start();
  }

  async startDiscordCrawler() {
    this.discordCrawler.onContentFound(async (content: any) => {
      await this.processContent('discord', content);
    });
    await this.discordCrawler.start();
  }

  async startFacebookCrawler() {
    this.facebookCrawler.onContentFound(async (content: any) => {
      await this.processContent('facebook', content);
    });
    await this.facebookCrawler.start();
  }

  // Process content through LLM intent analyzer
  private async processContent(platform: string, content: any) {
    try {
      // Make sure intent analyzer is set
      if (!this.intentAnalyzer) {
        console.error('Intent analyzer not set');
        return;
      }

      // Run intent analysis
      const intentData = await this.intentAnalyzer.analyzeIntent(content.text);
      
      // If high intent detected, trigger response
      if (intentData.isHighIntent) {
        console.log(`High intent detected on ${platform}:`, content.id);
        
        // Send to response generator
        await this.intentAnalyzer.generateResponse(
          platform,
          content,
          intentData
        );
      }
    } catch (error) {
      console.error(`Error processing ${platform} content:`, error);
    }
  }
}
