import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { MessagingService } from "./messagingService";
import { AnalyticsService } from "./analyticsService";
import { FacebookCrawler } from "../crawlers/facebookCrawler";

export class IntentAnalyzer {
  private llm: ChatGroq;
  private intentPromptTemplate: ChatPromptTemplate;
  private responsePromptTemplate: ChatPromptTemplate;
  private messagingService: MessagingService;
  private analyticsService: AnalyticsService;
  private facebookCrawler: FacebookCrawler | null = null;

  constructor(
    llm: ChatGroq, 
    messagingService: MessagingService,
    analyticsService: AnalyticsService
  ) {
    this.llm = llm;
    this.messagingService = messagingService;
    this.analyticsService = analyticsService;

    // Create prompt template for sales intent detection
    this.intentPromptTemplate = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are an expert sales opportunity detector. Your job is to analyze text from social media 
        and determine if it indicates a high-intent sales opportunity.
        
        HIGH INTENT indicators include:
        - User explicitly looking to buy a product
        - User asking for product recommendations
        - User complaining about problems that our products could solve
        - User expressing frustration with current solutions
        
        Analyze the text and respond with a JSON object:
        {
          "isHighIntent": boolean,
          "intentScore": number (0-100),
          "topics": string[],
          "relevantProducts": string[],
          "urgency": "low" | "medium" | "high",
          "reasoning": string
        }
        
        Only classify as high intent if you're very confident the user is close to making a purchase decision.`
      ],
      ["user", "{text}"]
    ]);

    // Create prompt template for generating responses
    this.responsePromptTemplate = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are an expert at creating personalized, helpful ad responses for high-intent sales opportunities. 
        Given a post/comment from a user and intent analysis, craft a response that:
        
        1. Is conversational and not overtly salesy
        2. Acknowledges their specific problem or need
        3. Provides genuine value/information first
        4. Subtly mentions our relevant product only if appropriate
        5. Uses a natural, helpful tone (not corporate marketing speak)
        6. Keeps responses concise (max 2-3 short paragraphs)
        
        Your goal is to start a conversation, not close a sale immediately.`
      ],
      [
        "user", 
        `Original content: {originalText}
        
        Platform: {platform}
        
        Intent analysis: {intentAnalysis}
        
        Generate a helpful, non-pushy response that could be posted as a reply.`
      ]
    ]);
  }

  // Set Facebook crawler for ad creation
  setFacebookCrawler(crawler: FacebookCrawler) {
    this.facebookCrawler = crawler;
  }

  // Analyze text for sales intent
  async analyzeIntent(text: string) {
    try {
      const intentPrompt = await this.intentPromptTemplate.invoke({ text });
      const intentResponse = await this.llm.invoke(intentPrompt);
      
      // Parse the JSON response
      const intentData = JSON.parse(String(intentResponse.content));
      
      // Log intent detection for analytics
      this.analyticsService.logIntentDetection({
        text,
        intentData,
        timestamp: Date.now()
      });
      
      return intentData;
    } catch (error) {
      console.error("Error analyzing intent:", error);
      // Return default low intent data on error
      return {
        isHighIntent: false,
        intentScore: 0,
        topics: [],
        relevantProducts: [],
        urgency: "low",
        reasoning: "Error analyzing intent"
      };
    }
  }

  // Generate response for high-intent content
  async generateResponse(platform: string, content: any, intentData: any) {
    try {
      const responsePrompt = await this.responsePromptTemplate.invoke({
        originalText: content.text,
        platform,
        intentAnalysis: JSON.stringify(intentData)
      });
      
      const responseContent = await this.llm.invoke(responsePrompt);
      
      // Send the response via the messaging service
      const responseId = await this.messagingService.sendMessage(
        platform as any,
        {
          recipient: this.getRecipientId(platform, content),
          text: responseContent.content,
          metadata: content.metadata
        }
      );
      
      // Log the response for analytics
      this.analyticsService.logResponse({
        platform,
        contentId: content.id,
        responseId,
        intentData,
        responseText: responseContent.content,
        timestamp: Date.now()
      });

      // If platform is Facebook and intent score is high enough, create an ad
      if (platform === 'facebook' && intentData.intentScore > 70 && this.facebookCrawler) {
        try {
          const adId = await this.facebookCrawler.createMetaAd(intentData, content);
          
          if (adId) {
            // Log ad creation in analytics
            this.analyticsService.logAdCreation({
              platform,
              contentId: content.id,
              adId,
              intentData,
              timestamp: Date.now()
            });
            
            console.log(`Created Facebook Ad: ${adId} for high-intent content`);
          }
        } catch (error) {
          console.error("Error creating Facebook ad:", error);
        }
      }
      
      return responseContent.content;
    } catch (error) {
      console.error("Error generating response:", error);
      return null;
    }
  }

  // Helper to get the appropriate recipient ID based on the platform
  private getRecipientId(platform: string, content: any): string {
    switch (platform) {
      case 'reddit':
        return content.id; // The post or comment ID
      case 'discord':
        return content.channelId;
      case 'facebook':
        return content.id; // Post ID
      case 'whatsapp':
        return content.phoneNumber;
      default:
        return content.id;
    }
  }
}
