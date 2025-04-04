import { EventEmitter } from 'events';

export class RedditCrawler extends EventEmitter {
  private subreddits: string[] = [];
  private pollingInterval: number = 60000; // 1 minute
  private timer: NodeJS.Timeout | null = null;
  private lastChecked: Record<string, number> = {};
  private redditToken: string;

  constructor() {
    super();
    this.redditToken = process.env.REDDIT_TOKEN || '';
  }

  // Add subreddits to monitor
  addSubreddits(subreddits: string[]) {
    this.subreddits = [...new Set([...this.subreddits, ...subreddits])];
    // Initialize last checked time
    for (const subreddit of subreddits) {
      if (!this.lastChecked[subreddit]) {
        this.lastChecked[subreddit] = Date.now();
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
    await this.checkSubreddits();

    // Set up recurring checks
    this.timer = setInterval(async () => {
      await this.checkSubreddits();
    }, this.pollingInterval);

    console.log('Reddit crawler started');
  }

  // Stop the crawler
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    console.log('Reddit crawler stopped');
  }

  // Check each subreddit for new posts
  private async checkSubreddits() {
    try {
      for (const subreddit of this.subreddits) {
        const posts = await this.fetchNewPosts(subreddit);
        
        for (const post of posts) {
          // Only process posts created after our last check
          if (post.created_utc * 1000 > this.lastChecked[subreddit]) {
            this.emit('content', {
              platform: 'reddit',
              type: 'post',
              id: post.name, // Reddit fullname (t3_postid)
              text: post.title + '\n' + post.selftext,
              url: `https://reddit.com${post.permalink}`,
              author: post.author,
              subreddit: post.subreddit,
              created: post.created_utc * 1000,
              metadata: post
            });
          }

          // Also check comments on this post
          const comments = await this.fetchComments(post.id);
          for (const comment of comments) {
            if (comment.created_utc * 1000 > this.lastChecked[subreddit]) {
              this.emit('content', {
                platform: 'reddit',
                type: 'comment',
                id: comment.name, // Reddit fullname (t1_commentid)
                text: comment.body,
                url: `https://reddit.com${post.permalink}${comment.id}`,
                author: comment.author,
                subreddit: comment.subreddit,
                postId: post.name,
                created: comment.created_utc * 1000,
                metadata: comment
              });
            }
          }
        }

        // Update last checked time
        this.lastChecked[subreddit] = Date.now();
      }
    } catch (error) {
      console.error('Error checking subreddits:', error);
    }
  }

  // Fetch new posts from a subreddit
  private async fetchNewPosts(subreddit: string) {
    const url = `https://oauth.reddit.com/r/${subreddit}/new.json?limit=25`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.redditToken}`,
          'User-Agent': 'SalesIntentBot/1.0'
        }
      });

      const data = await response.json();
      return data.data.children.map((child: any) => child.data);
    } catch (error) {
      console.error(`Error fetching posts from r/${subreddit}:`, error);
      return [];
    }
  }

  // Fetch comments from a post
  private async fetchComments(postId: string) {
    const url = `https://oauth.reddit.com/comments/${postId}.json`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.redditToken}`,
          'User-Agent': 'SalesIntentBot/1.0'
        }
      });

      const data = await response.json();
      // Reddit returns an array with two elements - post data and comments
      return this.extractComments(data[1].data.children);
    } catch (error) {
      console.error(`Error fetching comments for post ${postId}:`, error);
      return [];
    }
  }

  // Extract comments from Reddit API response
  private extractComments(children: any[], comments: any[] = []) {
    for (const child of children) {
      if (child.kind === 't1') { // t1 is a comment
        comments.push(child.data);
      }
      
      // Recursively process reply chains
      if (child.data.replies && child.data.replies.data) {
        this.extractComments(child.data.replies.data.children, comments);
      }
    }
    return comments;
  }
}
