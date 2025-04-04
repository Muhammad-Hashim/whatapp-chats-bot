import express from "express";
import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
require("dotenv").config();
const GROQ_API_KEY = process.env.GrOQ_API_KEY;
const authToken = process.env.AUTH_TOKEN;
process.env.LANGSMITH_TRACING;
process.env.LANGSMITH_API_KEY;

const llm = new ChatGroq({
  model: "mixtral-8x7b-32768",
  temperature: 0,
  apiKey: GROQ_API_KEY,
});
const promptTemplate = ChatPromptTemplate.fromMessages([
  [
    "system",
    "You talk like salaes  give i all  to the best of your ability.Answer only what the user asks. Do not provide additional information unless explicitly requested like list.",
  ],
  ["placeholder", "{messages}"],
]);
import {
  START,
  END,
  MessagesAnnotation,
  StateGraph,
  MemorySaver,
} from "@langchain/langgraph";
// Define the function that calls the model
const callModel = async (state: typeof MessagesAnnotation.State) => {
  const prompts = await promptTemplate.invoke(state);
  const response = await llm.invoke(prompts);
  return { messages: response };
};
import { v4 as uuidv4 } from "uuid";

const config = { configurable: { thread_id: uuidv4() } };
// Define a new graph
const workflow = new StateGraph(MessagesAnnotation)
  // Define the node and edge
  .addNode("model", callModel)
  .addEdge(START, "model")
  .addEdge("model", END);

// Add memory
const memory = new MemorySaver();
const llmApp = workflow.compile({ checkpointer: memory });

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/webhook", (req, res) => {
  const VERIFY_TOKEN = "hashim";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully.");
    res.status(200).send(challenge);
  } else {
    res.status(403).send("Verification failed.");
  }
});

// Platform messaging service
interface MessagePayload {
  text: string;
  recipient: string;
  metadata?: Record<string, any>;
}

class MessagingService {
  // Send message to any supported platform
  async sendMessage(
    platform: "whatsapp" | "reddit" | "discord" | "facebook",
    payload: MessagePayload
  ): Promise<any> {
    switch (platform) {
      case "whatsapp":
        return this.sendWhatsAppMessage(payload.recipient, payload.text);
      case "reddit":
        return this.sendRedditMessage(
          payload.recipient,
          payload.text,
          payload.metadata
        );
      case "discord":
        return this.sendDiscordMessage(
          payload.recipient,
          payload.text,
          payload.metadata
        );
      case "facebook":
        return this.sendFacebookMessage(
          payload.recipient,
          payload.text,
          payload.metadata
        );
      default:
        throw new Error(`Platform ${platform} not supported`);
    }
  }

  // WhatsApp implementation (enhanced existing function)
  private async sendWhatsAppMessage(
    phoneNumber: string,
    message: string
  ): Promise<any> {
    const url = "https://graph.facebook.com/v22.0/257940540728538/messages";

    const payload = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "text",
      text: { body: message },
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log("WhatsApp Response:", data);
      return data;
    } catch (error) {
      console.error("WhatsApp Error:", error);
      throw error;
    }
  }

  // Reddit implementation
  private async sendRedditMessage(
    threadId: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<any> {
    // Reddit API requires OAuth2 authentication
    const redditToken = process.env.REDDIT_TOKEN;
    const url = `https://oauth.reddit.com/api/comment`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${redditToken}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          api_type: "json",
          thing_id: threadId, // Reddit thread/comment ID
          text: message,
        }),
      });

      const data = await response.json();
      console.log("Reddit Response:", data);
      return data;
    } catch (error) {
      console.error("Reddit Error:", error);
      throw error;
    }
  }

  // Discord implementation
  private async sendDiscordMessage(
    channelId: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<any> {
    const discordToken = process.env.DISCORD_BOT_TOKEN;
    const url = `https://discord.com/api/v10/channels/${channelId}/messages`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bot ${discordToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: message,
        }),
      });

      const data = await response.json();
      console.log("Discord Response:", data);
      return data;
    } catch (error) {
      console.error("Discord Error:", error);
      throw error;
    }
  }

  // Facebook implementation
  private async sendFacebookMessage(
    pagePostId: string,
    message: string,
    metadata?: Record<string, any>
  ): Promise<any> {
    const url = `https://graph.facebook.com/v17.0/${pagePostId}/comments`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message,
        }),
      });

      const data = await response.json();
      console.log("Facebook Response:", data);
      return data;
    } catch (error) {
      console.error("Facebook Error:", error);
      throw error;
    }
  }
}

// Create instance of messaging service
const messagingService = new MessagingService();

app.post("/webhook", express.json(), async (req, res): Promise<void> => {
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message || !message.text.body || !message.from) {
    res.status(404).send("No message received.");
    return;
  }

  try {
    // Get the input from the message
    const userMessage = message?.text?.body ? String(message.text.body) : "No message";
    const userPhone = message.from;
    
    // Set up thread ID for conversation context
    const config = { configurable: { thread_id: uuidv4() } };
    
    // Process the user's message with the LLM
    const input = [{ role: "user", content: userMessage }];
    const output = await llmApp.invoke({ messages: input }, config);
    
    // Get the LLM response
    const response = String(output.messages[output.messages.length - 1].content);
    
    // Send response back to the user
    await messagingService.sendMessage("whatsapp", {
      recipient: userPhone,
      text: response,
    });

    console.log(`Message from ${userPhone} processed: "${userMessage}"`);
    console.log(`Response sent: "${response}"`);
    
    res.status(200).json({ message: "Message sent successfully." });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ message: "Error processing message" });
  }
});

// Import necessary services
import { FacebookCrawler } from "./crawlers/facebookCrawler";
import { AnalyticsService } from "./services/analyticsService";
import { IntentAnalyzer } from "./services/intentAnalyzer";
import { CrawlerManager } from "./crawlers/index";

// Create instances of services
const analyticsService = new AnalyticsService();

// Make analytics service globally accessible for the Facebook crawler
(global as any).analyticsService = analyticsService;

// Create intent analyzer
const intentAnalyzer = new IntentAnalyzer(
  llm,
  messagingService,
  analyticsService
);

// Set up Facebook crawler
const facebookCrawler = new FacebookCrawler();
intentAnalyzer.setFacebookCrawler(facebookCrawler);

// Set up crawler manager
const crawlerManager = new CrawlerManager();
crawlerManager.setIntentAnalyzer(intentAnalyzer);

// Start monitoring public data (if env vars are set)
if (process.env.FACEBOOK_TOKEN && process.env.FB_AD_ACCOUNT_ID) {
  // Add pages and groups to monitor
  const pagesToMonitor = process.env.FB_PAGES_TO_MONITOR?.split(",") || [];
  const groupsToMonitor = process.env.FB_GROUPS_TO_MONITOR?.split(",") || [];

  if (pagesToMonitor.length > 0) {
    facebookCrawler.addPages(pagesToMonitor);
  }

  if (groupsToMonitor.length > 0) {
    facebookCrawler.addGroups(groupsToMonitor);
  }

  // Start ad performance tracking
  facebookCrawler.startAdPerformanceTracking();

  // Register endpoints for Facebook data
  app.get("/api/facebook/trends", async (req, res) => {
    const placeId = req.query.placeId as string || "107852219231636"; // Default USA
    const trends = await facebookCrawler.getTrendingTopics(placeId);
    res.json(trends);
  });

  app.get("/api/facebook/search", async (req, res) => {
    const query = req.query.q as string;
    const type = req.query.type as "page" | "event" | "group" || "page";
    const limit = parseInt(req.query.limit as string || "25");

    if (!query) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    const results = await facebookCrawler.searchPublicContent(
      query,
      type,
      limit
    );
    res.json(results);
  });

  app.get("/api/facebook/campaigns", async (req, res) => {
    const campaigns = await facebookCrawler.getAllCampaigns();
    res.json(campaigns);
  });

  app.get("/api/facebook/campaign/:id/stats", async (req, res) => {
    const campaignId = req.params.id;
    const datePreset = req.query.datePreset as string || "last_7_days";

    const stats = await facebookCrawler.getCampaignStats(
      campaignId,
      undefined,
      datePreset
    );
    res.json(stats);
  });

  app.get("/api/facebook/ad/:id/stats", async (req, res) => {
    const adId = req.params.id;
    const datePreset = req.query.datePreset as string || "last_7_days";

    const stats = await facebookCrawler.getAdStats(adId, undefined, datePreset);
    res.json(stats);
  });

  // Add this within the if (process.env.FACEBOOK_TOKEN && process.env.FB_AD_ACCOUNT_ID) { ... } block
  app.post("/api/facebook/group-campaign", express.json(), async (req, res) => {
    try {
      const { groupId, topic, adContent } = req.body;
      
      if (!groupId || !topic || !adContent) {
        return res.status(400).json({ 
          error: "Missing required parameters. Please provide groupId, topic, and adContent." 
        });
      }
      
      if (!adContent.headline || !adContent.description) {
        return res.status(400).json({ 
          error: "Ad content must include headline and description" 
        });
      }
      
      const result = await facebookCrawler.createTargetedGroupCampaign(groupId, topic, adContent);
      res.json({
        success: true,
        message: "Group targeted campaign created successfully",
        data: result
      });
    } catch (error) {
      console.error("Error creating group campaign:", error);
      res.status(500).json({ 
        error: "Failed to create group campaign", 
        message: error.message 
      });
    }
  });

  // Add an endpoint to create campaigns from identified high-intent group discussions
  app.post("/api/facebook/auto-campaign-from-discussion", express.json(), async (req, res) => {
    try {
      const { threshold = 70, maxCampaigns = 1 } = req.body;
      
      // Process monitored groups to find high intent discussions
      let campaignsCreated = 0;
      const result = [];
      
      // Get groups we're monitoring
      const groupsToMonitor = process.env.FB_GROUPS_TO_MONITOR?.split(",") || [];
      
      for (const groupId of groupsToMonitor) {
        if (campaignsCreated >= maxCampaigns) break;
        
        // Get latest posts from this group
        const since = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000); // 7 days ago
        const posts = await facebookCrawler.fetchGroupPosts(groupId, since);
        
        for (const post of posts) {
          if (campaignsCreated >= maxCampaigns) break;
          
          const postText = post.message || '';
          if (!postText || postText.length < 50) continue; // Skip short posts
          
          // Analyze the post for purchase intent
          const intentData = await intentAnalyzer.analyzeIntent(postText);
          
          // Check if this is a high-intent discussion
          if (intentData.isHighIntent && intentData.intentScore >= threshold) {
            console.log(`Found high-intent discussion in group ${groupId}: ${intentData.intentScore}`);
            
            // Create auto-generated ad content
            const adContent = {
              headline: `Solution for ${intentData.topics[0] || 'Your Problem'}`,
              description: `We noticed people discussing ${intentData.topics[0] || 'this topic'} and wanted to share a solution that's helped many others. Check out our ${intentData.relevantProducts[0] || 'products'} that specifically address this need.`,
              callToAction: intentData.urgency === 'high' ? 'SHOP_NOW' : 'LEARN_MORE'
            };
            
            // Create campaign targeting this group and topic
            const campaign = await facebookCrawler.createTargetedGroupCampaign(
              groupId, 
              intentData.topics[0] || 'general', 
              adContent
            );
            
            // Track this in our results
            result.push({
              groupId,
              postId: post.id,
              intentScore: intentData.intentScore,
              topics: intentData.topics,
              campaign
            });
            
            campaignsCreated++;
          }
        }
      }
      
      res.json({
        success: true,
        campaignsCreated,
        result
      });
    } catch (error) {
      console.error("Error creating automatic campaigns:", error);
      res.status(500).json({ 
        error: "Failed to create automatic campaigns", 
        message: error.message 
      });
    }
  });

  console.log("Facebook monitoring and API endpoints initialized");
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
