import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Phone,
  Mic,
  Bot,
  Shirt,
  Sparkles,
  Volume2,
  Settings,
  Play,
  Pause,
  PhoneOff,
  ShoppingBag,
  MessageSquare,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const inventorySeed = [
  { id: 1, name: "Midnight Street Set", color: "Black", sizes: ["S", "M", "L", "XL"], price: 58 },
  { id: 2, name: "Oversized Essential Tee", color: "Black", sizes: ["M", "L", "XL"], price: 24 },
  { id: 3, name: "Urban Cargo Pant", color: "Black", sizes: ["M", "L"], price: 38 },
  { id: 4, name: "Minimal Hoodie", color: "Cream", sizes: ["S", "M", "L"], price: 42 },
];

const quickReplies = [
  "Do you have black two-piece sets?",
  "What sizes are available in medium and large?",
  "Can I order on this call?",
  "What is your best-selling item this week?",
];

const defaultMusicGenerationRequest = {
  music_generation: {
    model: "Lyria 3",
    prompt:
      "A modern Afro Drill track at 140 BPM in a minor key, driven by a deep sliding 808 sub-bass with glide effects and punchy kick patterns. Crisp hi-hats with triplet rolls, syncopated snares, and percussive African drum elements create a rhythmic groove. Atmospheric pads and dark melodic plucks add a cinematic texture. Vocals are clean, confident, and slightly aggressive, delivered in a melodic drill cadence with subtle autotune and spatial reverb. The mix is polished, with strong stereo imaging, clear separation, and hard-hitting low-end typical of professional African drill production.",
    duration_seconds: 30,
  },
};

function formatCurrency(value) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value * 1600);
}

function parseMusicGenerationRequest(rawPayload) {
  const parsed = JSON.parse(rawPayload);
  const payload = parsed?.music_generation;

  if (!payload || typeof payload !== "object") throw new Error("Missing `music_generation` object.");

  const model = String(payload.model || "").trim();
  const prompt = String(payload.prompt || "").trim();
  const durationSeconds = Number(payload.duration_seconds);

  if (!model || !prompt || !Number.isFinite(durationSeconds)) {
    throw new Error("`model`, `prompt`, and numeric `duration_seconds` are required.");
  }

  if (durationSeconds <= 0 || durationSeconds > 600) {
    throw new Error("`duration_seconds` must be between 1 and 600.");
  }

  return {
    model,
    prompt,
    duration_seconds: Math.round(durationSeconds),
  };
}

function buildAgentReply(message, brandName, inventory, campaignGoal) {
  const text = String(message || "").toLowerCase();

  if (text.includes("black") && (text.includes("set") || text.includes("streetwear") || text.includes("two-piece"))) {
    const matches = inventory.filter((item) => item.color.toLowerCase() === "black");
    const names = matches.map((item) => `${item.name} for ${formatCurrency(item.price)}`).join(", ");
    return `Absolutely. ${brandName} has these black options right now: ${names}. I can help you choose a size and place the order immediately.`;
  }

  if (text.includes("medium") || text.includes("large") || text.includes("size")) {
    const available = inventory
      .filter((item) => item.sizes.includes("M") || item.sizes.includes("L"))
      .map((item) => `${item.name} (${item.sizes.join("/")})`)
      .join(", ");
    return `Yes — medium and large are available on several pieces, including ${available}. Tell me which style you want and I’ll recommend the best fit.`;
  }

  if (text.includes("order") || text.includes("buy") || text.includes("checkout")) {
    return "Yes. I can help you complete the order on this call by confirming your preferred item, size, delivery area, and payment method.";
  }

  if (text.includes("best") || text.includes("popular") || text.includes("selling")) {
    return "Our best-selling pick this week is the Midnight Street Set. Customers love it because it is clean, versatile, and easy to style for casual and premium looks.";
  }

  if (text.includes("hello") || text.includes("hi")) {
    return `Hi, this is ${brandName}. ${campaignGoal} What kind of outfit are you shopping for today?`;
  }

  return `Got it. For ${brandName}, I’d suggest starting with our Midnight Street Set or Oversized Essential Tee. I can help by color, size, price, or style vibe.`;
}

function runSelfChecks() {
  const sampleInventory = inventorySeed;
  const checks = [
    buildAgentReply("Do you have black sets?", "Luxe Thread", sampleInventory, "Sell new arrivals").includes("black options"),
    buildAgentReply("What sizes are available?", "Luxe Thread", sampleInventory, "Sell new arrivals").includes("medium and large"),
    buildAgentReply("Can I order now?", "Luxe Thread", sampleInventory, "Sell new arrivals").includes("complete the order"),
    formatCurrency(58).startsWith("₦"),
  ];

  return checks.every(Boolean);
}

const selfChecksPassed = runSelfChecks();

export default function AIVoiceCallClothingBrandApp() {
  const [brandName, setBrandName] = useState("Luxe Thread");
  const [callerName, setCallerName] = useState("Maya");
  const [phoneNumber, setPhoneNumber] = useState("+234 800 000 0000");
  const [campaignGoal, setCampaignGoal] = useState("We just dropped new arrivals and can help you place a quick order right on this call.");
  const [voiceStyle, setVoiceStyle] = useState("Warm");
  const [autoFollowUp, setAutoFollowUp] = useState(true);
  const [callActive, setCallActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [browserVoiceReady, setBrowserVoiceReady] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [selectedItem, setSelectedItem] = useState("Midnight Street Set");
  const [selectedSize, setSelectedSize] = useState("M");
  const [leadStatus, setLeadStatus] = useState("Interested");
  const [musicRequestText, setMusicRequestText] = useState(JSON.stringify(defaultMusicGenerationRequest, null, 2));
  const [musicRequestStatus, setMusicRequestStatus] = useState("Ready");
  const [musicBriefSummary, setMusicBriefSummary] = useState(null);
  const [transcript, setTranscript] = useState([
    { role: "System", text: "MVP ready: browser voice, smart replies, order capture, and post-call summary." },
    { role: "System", text: selfChecksPassed ? "Self-checks passed." : "Self-checks need attention." },
  ]);

  const recognitionRef = useRef(null);

  const metrics = useMemo(
    () => [
      { label: "Live status", value: callActive ? "On call" : "Offline" },
      { label: "Lead stage", value: leadStatus },
      { label: "Selected item", value: selectedItem },
      { label: "Selected size", value: selectedSize },
    ],
    [callActive, leadStatus, selectedItem, selectedSize]
  );

  const inventory = inventorySeed;

  useEffect(() => {
    const hasRecognition = typeof window !== "undefined" && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    const hasSynthesis = typeof window !== "undefined" && "speechSynthesis" in window;
    setBrowserVoiceReady(Boolean(hasRecognition && hasSynthesis));

    if (!hasRecognition) return undefined;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event) => {
      const heard = event.results?.[0]?.[0]?.transcript || "";
      if (!heard) return;
      handleCustomerMessage(heard);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        // no-op
      }
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [brandName, campaignGoal]);

  const speakText = (text) => {
    if (typeof window === "undefined" || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance === "undefined") {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.pitch = voiceStyle === "Luxury" ? 0.95 : voiceStyle === "Energetic" ? 1.1 : 1;
    utterance.rate = voiceStyle === "Minimal" ? 0.92 : voiceStyle === "Energetic" ? 1.05 : 0.98;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const addLine = (role, text) => {
    setTranscript((prev) => [...prev, { role, text }]);
  };

  const handleCustomerMessage = (message) => {
    addLine("Customer", message);
    const reply = buildAgentReply(message, brandName, inventory, campaignGoal);
    addLine("AI", reply);
    speakText(reply);

    const lowered = String(message || "").toLowerCase();
    if (lowered.includes("order") || lowered.includes("buy")) setLeadStatus("Ready to buy");
    if (lowered.includes("size") || lowered.includes("medium")) setSelectedSize("M");
    if (lowered.includes("large")) setSelectedSize("L");
    if (lowered.includes("set")) setSelectedItem("Midnight Street Set");
  };

  const startCall = () => {
    setCallActive(true);
    setLeadStatus("Interested");
    const welcome = `Hi ${callerName}, this is ${brandName}. ${campaignGoal}`;
    addLine("System", `Call started with ${callerName} on ${phoneNumber}.`);
    addLine("AI", welcome);
    speakText(welcome);
  };

  const endCall = () => {
    setCallActive(false);
    setIsListening(false);
    setIsSpeaking(false);
    try {
      recognitionRef.current?.stop();
    } catch {
      // no-op
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    addLine(
      "System",
      `Call ended. Summary: ${callerName} is ${leadStatus.toLowerCase()} in ${selectedItem}, size ${selectedSize}.${autoFollowUp ? " Follow-up message queued." : ""}`
    );
  };

  const toggleListening = () => {
    if (!callActive || !recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      return;
    }
    recognitionRef.current.start();
  };

  const handleManualSend = () => {
    if (!draftMessage.trim()) return;
    handleCustomerMessage(draftMessage.trim());
    setDraftMessage("");
  };

  const playPitch = () => {
    const pitch = `Hello from ${brandName}. We help you discover your perfect fit, choose your style, and place your order in minutes.`;
    addLine("AI", pitch);
    speakText(pitch);
  };

  const pauseVoice = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    addLine("System", "Voice playback paused.");
  };

  const handleMusicRequestImport = () => {
    try {
      const payload = parseMusicGenerationRequest(musicRequestText);
      setMusicBriefSummary(payload);
      setMusicRequestStatus(`Loaded: ${payload.model}, ${payload.duration_seconds}s`);
      addLine(
        "System",
        `Music brief ready (${payload.model}, ${payload.duration_seconds}s): ${payload.prompt.slice(0, 90)}...`
      );
    } catch (error) {
      setMusicBriefSummary(null);
      setMusicRequestStatus(`Invalid JSON: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 md:p-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col gap-4 rounded-3xl border bg-white/90 p-6 shadow-sm md:flex-row md:items-center md:justify-between"
        >
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="rounded-full">AI Voice Commerce MVP</Badge>
              <Badge variant="secondary" className="rounded-full">
                Fashion Sales
              </Badge>
              <Badge variant={browserVoiceReady ? "default" : "outline"} className="rounded-full">
                {browserVoiceReady ? "Browser voice ready" : "Voice fallback mode"}
              </Badge>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">AI voice sales app for your clothing brand</h1>
            <p className="max-w-2xl text-sm text-slate-600 md:text-base">
              This version speaks, listens in supported browsers, answers product questions, and captures an order-ready lead.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {metrics.map((item) => (
              <Card key={item.label} className="rounded-2xl shadow-none">
                <CardContent className="p-4">
                  <p className="text-xs text-slate-500">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold md:text-base">{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}>
            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Settings className="h-5 w-5" /> Brand and call setup
                </CardTitle>
                <CardDescription>Customize the sales assistant before starting a live demo call.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="brand">Brand name</Label>
                    <Input id="brand" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="caller">Customer name</Label>
                    <Input id="caller" value={callerName} onChange={(e) => setCallerName(e.target.value)} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone number</Label>
                    <Input id="phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Voice style</Label>
                    <Select value={voiceStyle} onValueChange={setVoiceStyle}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue placeholder="Select voice style" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Warm">Warm</SelectItem>
                        <SelectItem value="Luxury">Luxury</SelectItem>
                        <SelectItem value="Energetic">Energetic</SelectItem>
                        <SelectItem value="Minimal">Minimal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal">Sales goal / call script</Label>
                  <Textarea id="goal" value={campaignGoal} onChange={(e) => setCampaignGoal(e.target.value)} className="min-h-[100px]" />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Selected item</Label>
                    <Select value={selectedItem} onValueChange={setSelectedItem}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {inventory.map((item) => (
                          <SelectItem key={item.id} value={item.name}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Selected size</Label>
                    <Select value={selectedSize} onValueChange={setSelectedSize}>
                      <SelectTrigger className="rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["S", "M", "L", "XL"].map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-2xl border p-4">
                  <div>
                    <p className="text-sm font-medium">Auto follow-up message</p>
                    <p className="text-sm text-slate-500">Prepare an SMS or WhatsApp summary after the call.</p>
                  </div>
                  <Switch checked={autoFollowUp} onCheckedChange={setAutoFollowUp} />
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Button onClick={startCall} disabled={callActive} className="rounded-2xl">
                    <Phone className="mr-2 h-4 w-4" /> Start call
                  </Button>
                  <Button onClick={endCall} disabled={!callActive} variant="destructive" className="rounded-2xl">
                    <PhoneOff className="mr-2 h-4 w-4" /> End call
                  </Button>
                  <Button onClick={toggleListening} disabled={!callActive || !browserVoiceReady} variant="secondary" className="rounded-2xl">
                    <Mic className="mr-2 h-4 w-4" /> {isListening ? "Stop listening" : "Listen"}
                  </Button>
                  <Button onClick={isSpeaking ? pauseVoice : playPitch} variant="outline" className="rounded-2xl">
                    {isSpeaking ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                    {isSpeaking ? "Pause voice" : "Play pitch"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: 0.08 }} className="space-y-6">
            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Bot className="h-5 w-5" /> Live agent console
                </CardTitle>
                <CardDescription>The AI handles customer questions and moves them toward purchase.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs text-slate-500">Call status</p>
                    <p className="mt-1 font-semibold">{callActive ? "Live" : "Idle"}</p>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs text-slate-500">Listening</p>
                    <p className="mt-1 font-semibold">{isListening ? "Yes" : "No"}</p>
                  </div>
                  <div className="rounded-2xl border p-4">
                    <p className="text-xs text-slate-500">Speaking</p>
                    <p className="mt-1 font-semibold">{isSpeaking ? "Yes" : "No"}</p>
                  </div>
                </div>

                <div className="rounded-3xl bg-slate-950 p-5 text-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Volume2 className="h-4 w-4" />
                      <span className="text-sm">Voice engine</span>
                    </div>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs">
                      {browserVoiceReady ? "Browser speech API" : "Manual demo mode"}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${callActive ? "bg-green-400" : "bg-slate-500"}`} />
                    <p className="text-sm text-slate-300">
                      {callActive
                        ? `${brandName}'s AI is handling the conversation and guiding the customer to checkout.`
                        : "Start the call to begin the live fashion sales demo."}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="manualMessage">Manual customer message</Label>
                  <div className="flex gap-2">
                    <Input
                      id="manualMessage"
                      value={draftMessage}
                      onChange={(e) => setDraftMessage(e.target.value)}
                      placeholder="Type what the customer says..."
                    />
                    <Button onClick={handleManualSend} className="rounded-xl">
                      Send
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Quick test prompts</p>
                  <div className="flex flex-wrap gap-2">
                    {quickReplies.map((reply) => (
                      <button
                        key={reply}
                        onClick={() => handleCustomerMessage(reply)}
                        className="rounded-full border bg-white px-3 py-2 text-sm transition hover:bg-slate-50"
                        type="button"
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Sparkles className="h-5 w-5" /> Music generation brief
                </CardTitle>
                <CardDescription>Paste a JSON payload to stage a soundtrack prompt for your campaign.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label htmlFor="musicPayload">Music JSON payload</Label>
                <Textarea
                  id="musicPayload"
                  value={musicRequestText}
                  onChange={(e) => setMusicRequestText(e.target.value)}
                  className="min-h-[220px] font-mono text-xs"
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-600">{musicRequestStatus}</p>
                  <Button type="button" onClick={handleMusicRequestImport} variant="outline" className="rounded-xl">
                    Import brief
                  </Button>
                </div>
                {musicBriefSummary ? (
                  <div className="rounded-2xl border bg-slate-50 p-4 text-sm">
                    <p className="font-medium text-slate-700">Imported brief</p>
                    <p className="mt-1 text-slate-600">
                      <span className="font-medium">Model:</span> {musicBriefSummary.model}
                    </p>
                    <p className="text-slate-600">
                      <span className="font-medium">Duration:</span> {musicBriefSummary.duration_seconds}s
                    </p>
                    <p className="mt-2 line-clamp-3 text-slate-600">{musicBriefSummary.prompt}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Sparkles className="h-5 w-5" /> Conversation transcript
                </CardTitle>
                <CardDescription>Use voice input or the quick prompts to simulate a real sales call.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-[420px] space-y-3 overflow-auto pr-1">
                  {transcript.map((item, index) => (
                    <div
                      key={`${item.role}-${index}`}
                      className={`rounded-2xl p-4 ${
                        item.role === "AI"
                          ? "bg-slate-100"
                          : item.role === "Customer"
                            ? "border bg-white"
                            : "border border-amber-100 bg-amber-50"
                      }`}
                    >
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{item.role}</p>
                      <p className="text-sm text-slate-700">{item.text}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-0 shadow-sm">
              <CardContent className="grid gap-4 p-6 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <Shirt className="mb-2 h-5 w-5" />
                  <p className="font-medium">Product discovery</p>
                  <p className="text-sm text-slate-500">The agent recommends outfits, sizes, colors, and matching pieces.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <ShoppingBag className="mb-2 h-5 w-5" />
                  <p className="font-medium">Order capture</p>
                  <p className="text-sm text-slate-500">It updates the selected item and size as the conversation becomes purchase-ready.</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <MessageSquare className="mb-2 h-5 w-5" />
                  <p className="font-medium">Post-call follow-up</p>
                  <p className="text-sm text-slate-500">A follow-up summary can be sent after the call for checkout completion.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <CheckCircle2 className="h-5 w-5" /> Next production upgrades
                </CardTitle>
                <CardDescription>This MVP works in-browser. The next step is connecting real phone calling.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                <div className="rounded-2xl border p-4">Connect Twilio or a SIP provider for real voice calls to actual phone numbers.</div>
                <div className="rounded-2xl border p-4">Plug in OpenAI real-time voice for more natural conversation and better memory.</div>
                <div className="rounded-2xl border p-4">Sync your product catalog and stock from Shopify or your store backend.</div>
                <div className="rounded-2xl border p-4">Save call logs, customer interests, and abandoned orders to a CRM or database.</div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
