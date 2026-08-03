"use client";

import { useState, useEffect } from "react";
import { Key, Bot, BellRing, Save, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Settings() {
  const [keys, setKeys] = useState({ openai: "", anthropic: "", gemini: "" });
  const [agentConfig, setAgentConfig] = useState({ aggressiveness: 50, maxThreads: 4 });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedKeys = localStorage.getItem("strix_api_keys");
    if (savedKeys) setKeys(JSON.parse(savedKeys));
    
    const savedConfig = localStorage.getItem("strix_agent_config");
    if (savedConfig) setAgentConfig(JSON.parse(savedConfig));
  }, []);

  const handleSave = (tab: "api" | "agent") => {
    if (tab === "api") {
      localStorage.setItem("strix_api_keys", JSON.stringify(keys));
    } else if (tab === "agent") {
      localStorage.setItem("strix_agent_config", JSON.stringify(agentConfig));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-8 h-full flex flex-col space-y-8 max-w-5xl mx-auto w-full overflow-y-auto">
      <div>
        <h1 className="text-3xl font-heading font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Configure global preferences and AI agent behavior.</p>
      </div>

      <Tabs defaultValue="api" className="flex flex-col md:flex-row gap-8">
        <TabsList className="flex flex-col h-auto w-full md:w-64 bg-transparent gap-2 p-0">
          <TabsTrigger value="api" className="w-full justify-start gap-2 px-4 py-3 data-[state=active]:bg-secondary/50 data-[state=active]:text-primary border border-transparent data-[state=active]:border-border/50 rounded-lg transition-all">
            <Key className="w-4 h-4" /> API Configuration
          </TabsTrigger>
          <TabsTrigger value="agent" className="w-full justify-start gap-2 px-4 py-3 data-[state=active]:bg-secondary/50 data-[state=active]:text-primary border border-transparent data-[state=active]:border-border/50 rounded-lg transition-all">
            <Bot className="w-4 h-4" /> Agent Behavior
          </TabsTrigger>
          <TabsTrigger value="notifications" className="w-full justify-start gap-2 px-4 py-3 data-[state=active]:bg-secondary/50 data-[state=active]:text-primary border border-transparent data-[state=active]:border-border/50 rounded-lg transition-all">
            <BellRing className="w-4 h-4" /> Notifications
          </TabsTrigger>
        </TabsList>

        <div className="flex-1">
          <TabsContent value="api" className="m-0 focus-visible:outline-none focus-visible:ring-0 animate-in fade-in slide-in-from-right-4 duration-500">
            <Card className="bg-background/40 backdrop-blur-md border-border/50 shadow-xl">
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
                <CardDescription>Configure external LLM providers for autonomous analysis.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>OpenAI API Key</Label>
                  <Input 
                    type="password" 
                    placeholder="sk-..." 
                    value={keys.openai} 
                    onChange={e => setKeys({...keys, openai: e.target.value})}
                    className="bg-secondary/30"
                  />
                  <p className="text-xs text-muted-foreground">Used for gpt-4o models during penetration testing.</p>
                </div>
                <div className="space-y-2">
                  <Label>Anthropic API Key</Label>
                  <Input 
                    type="password" 
                    placeholder="sk-ant-..." 
                    value={keys.anthropic} 
                    onChange={e => setKeys({...keys, anthropic: e.target.value})}
                    className="bg-secondary/30"
                  />
                  <p className="text-xs text-muted-foreground">Used for claude-3.5-sonnet reasoning capabilities.</p>
                </div>
                <div className="space-y-2">
                  <Label>Google Gemini API Key</Label>
                  <Input 
                    type="password" 
                    placeholder="AIza..." 
                    value={keys.gemini} 
                    onChange={e => setKeys({...keys, gemini: e.target.value})}
                    className="bg-secondary/30"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t border-border/20 pt-6">
                <div className="text-sm font-medium text-primary flex items-center gap-2 opacity-0 transition-opacity" style={{ opacity: saved ? 1 : 0 }}>
                  <CheckCircle2 className="w-4 h-4" /> Saved successfully
                </div>
                <Button onClick={() => handleSave("api")} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  <Save className="w-4 h-4" /> Save Configuration
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="agent" className="m-0 focus-visible:outline-none focus-visible:ring-0 animate-in fade-in slide-in-from-right-4 duration-500">
            <Card className="bg-background/40 backdrop-blur-md border-border/50 shadow-xl">
              <CardHeader>
                <CardTitle>Agent Behavior</CardTitle>
                <CardDescription>Tune the heuristics and aggressiveness of the autonomous agent.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base">Exploitation Aggressiveness</Label>
                    <span className="font-mono text-primary font-bold">{agentConfig.aggressiveness}%</span>
                  </div>
                  <Slider 
                    value={[agentConfig.aggressiveness]} 
                    onValueChange={v => setAgentConfig({...agentConfig, aggressiveness: v[0]})}
                    max={100} step={1}
                    className="py-4"
                  />
                  <p className="text-xs text-muted-foreground">Higher values allow the agent to attempt more intrusive exploits and bypasses.</p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <Label className="text-base">Max Concurrent Threads</Label>
                    <span className="font-mono text-primary font-bold">{agentConfig.maxThreads}</span>
                  </div>
                  <Slider 
                    value={[agentConfig.maxThreads]} 
                    onValueChange={v => setAgentConfig({...agentConfig, maxThreads: v[0]})}
                    min={1} max={16} step={1}
                    className="py-4"
                  />
                  <p className="text-xs text-muted-foreground">Number of parallel tasks the agent can spawn during reconnaissance.</p>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between border-t border-border/20 pt-6">
                <div className="text-sm font-medium text-primary flex items-center gap-2 opacity-0 transition-opacity" style={{ opacity: saved ? 1 : 0 }}>
                  <CheckCircle2 className="w-4 h-4" /> Saved successfully
                </div>
                <Button onClick={() => handleSave("agent")} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  <Save className="w-4 h-4" /> Save Configuration
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="m-0 focus-visible:outline-none focus-visible:ring-0 animate-in fade-in slide-in-from-right-4 duration-500">
            <Card className="bg-background/40 backdrop-blur-md border-border/50 shadow-xl border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <BellRing className="w-12 h-12 mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-foreground">Integrations Coming Soon</h3>
                <p className="text-sm">Slack, Microsoft Teams, and Webhook integrations are on the roadmap.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
