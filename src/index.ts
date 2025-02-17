import express from "express";
import axios from "axios";
import { Request, Response } from "express";
import { ChatGroq } from "@langchain/groq";
import { ChatPromptTemplate } from "@langchain/core/prompts";
require("dotenv").config();
const GROQ_API_KEY = "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";
const authToken =
  "EAAQ5nukhyqwBO0rit76eXflZC2APoYEnGNb7IqyesFeVh8KZAfR75WIhq0k84KJZAs8vhGFPSvoSp5iZBAIK8yknFQoe4vQdGE7N0qas1mbZAbQU5a6TpYqYvWfZCzwnO0talprOwZAO2DhlTzpqdDZAP7ykZCmdt7ZCGKXhHcgSTw40Jl1cBTlBEsEBwCxsy3OtqrZCx9qqGqGh0njhQhgsoP4HglYUZAWj16YhcQhjrq8oUe4ZD";
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

app.post("/webhook", express.json(), async (req, res): Promise<void> => {
  console.log("Request:", req.body);
  const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  console.log("Message:", message);
  if (!message) {
    res.sendStatus(200);
    return;
  }
  const input = [
    {
      role: "user",
      content: "Hi! I'm Bob.",
    },
  ];
  const output = await llmApp.invoke({ messages: input }, config);
  // The output contains all messages in the state.
  // This will long the last message in the conversation.d
  const input2 = [
    {
      role: "user",
      content: `[
  {
    "id": "P1001",
    "name": "Smartphone X1",
    "category": "Electronics",
    "price": 699.99,
    "warranty": "1 Year",
    "issues": [
      "Screen not responding",
      "Battery draining fast",
      "Not charging properly"
    ],
    "solutions": [
      "Restart your phone and check again.",
      "Calibrate battery by draining and fully charging.",
      "Use a certified charger and check the charging port."
    ]
  },
  {
    "id": "P1002",
    "name": "Wireless Earbuds Pro",
    "category": "Audio",
    "price": 129.99,
    "warranty": "6 Months",
    "issues": [
      "Left earbud not working",
      "Bluetooth disconnecting",
      "Low sound quality"
    ],
    "solutions": [
      "Reset earbuds and pair again.",
      "Ensure no other device is interfering.",
      "Check the EQ settings in your phone."
    ]
  },
  {
    "id": "P1003",
    "name": "Gaming Laptop Z5",
    "category": "Computers",
    "price": 1499.99,
    "warranty": "2 Years",
    "issues": [
      "Overheating during gaming",
      "Lagging in high-performance tasks",
      "Keyboard keys not working"
    ],
    "solutions": [
      "Clean the air vents and use a cooling pad.",
      "Update your GPU drivers and close background apps.",
      "Check for stuck keys or reset keyboard settings."
    ]
  }
]
`,
    },
  ];
  const config2 = { configurable: { thread_id: uuidv4() } };
  const output2 = await llmApp.invoke({ messages: input2 }, config2);
  console.log(output2.messages[output2.messages.length - 1].content);
  const input3 = [
    {
      role: "user",
      content: String(message.text), // Ensure it's a string
    },
  ];

  // Invoke the model
  const output3 = await llmApp.invoke({ messages: input3 }, config2);
  console.log(output3.messages[output3.messages.length - 1]);

  // Get phone number and ensure content is a string
  const userPhone = message.from;
  const userInput: string = String(
    output3.messages[output3.messages.length - 1].content
  );

  // Send WhatsApp message
  await sendWhatsAppMessage(userPhone, userInput);
  res.status(200);
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

async function sendWhatsAppMessage(phoneNumber: string, input: any) {
  const url = "https://graph.facebook.com/v22.0/257940540728538/messages";

  const payload = {
    messaging_product: "whatsapp",
    to: phoneNumber,
    type: "text",
    text: { body: input },
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
    console.log("Response:", data);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Example usage
