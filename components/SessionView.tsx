import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Language } from '../types';
import { GoogleGenAI, Modality, Chat, LiveServerMessage, Blob as GenAIBlob, Type } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { 
  ArrowLeft, 
  Settings, 
  Share, 
  MoreVertical, 
  Plus, 
  Search, 
  Globe, 
  Zap, 
  Upload, 
  Link, 
  HardDrive, 
  Copy, 
  AudioWaveform, 
  Network, 
  FileText, 
  Layers, 
  BarChart3, 
  Bot,
  X,
  PanelLeft,
  PanelRight,
  Mic,
  ArrowRight,
  Activity,
  CheckCircle2,
  Play,
  Download,
  RefreshCw,
  Square,
  Volume2,
  Pause,
  Image as ImageIcon,
  Loader2,
  Phone,
  ZoomIn,
  ZoomOut,
  Move
} from 'lucide-react';

interface SessionViewProps {
  language: Language;
  onBack: () => void;
}

type TabType = 'summary' | 'audio' | 'mindmap' | 'infographic';

interface UploadedFile {
  name: string;
  type: string;
  size: number;
}

// --- Mind Map Types ---
interface MapNode {
  id: string;
  label: string;
  x: number;
  y: number;
  level: number; // 0 = center, 1 = main branch, 2 = sub
}

interface MapEdge {
  from: string;
  to: string;
}

// --- Audio Helper Functions ---
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): GenAIBlob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const getVolume = (analyser: AnalyserNode | null) => {
    if (!analyser) return 0;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
    }
    return sum / dataArray.length / 255;
};

export const SessionView: React.FC<SessionViewProps> = ({ language, onBack }) => {
  const [mobilePanel, setMobilePanel] = useState<'none' | 'sources' | 'studio'>('none');
  const [hasInteraction, setHasInteraction] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('summary');
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'completed'>('idle');
  const [inputText, setInputText] = useState('');
  const [query, setQuery] = useState('');
  
  // Input Mode State: 'text' (default) or 'voice'
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  
  // Content State
  const [summaryContent, setSummaryContent] = useState<string>('');
  
  // Mind Map State
  const [mapNodes, setMapNodes] = useState<MapNode[]>([]);
  const [mapEdges, setMapEdges] = useState<MapEdge[]>([]);
  const [isMapLoading, setIsMapLoading] = useState(false);
  const [mapTransform, setMapTransform] = useState({ x: 0, y: 0, k: 1 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const mapSvgRef = useRef<SVGSVGElement>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Infographic State
  const [infographicImage, setInfographicImage] = useState<string | null>(null);
  const [isInfographicLoading, setIsInfographicLoading] = useState(false);

  // File Upload State
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Voice interaction states
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  
  // Live Mode State
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveStatus, setLiveStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const liveSessionRef = useRef<any>(null); // Store the live session promise
  const liveAudioContextRef = useRef<AudioContext | null>(null); // Dedicated context for live
  const liveInputContextRef = useRef<AudioContext | null>(null); // Dedicated context for mic input
  const liveNextStartTimeRef = useRef<number>(0);
  const liveSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Visualizer Refs
  const liveInputAnalyserRef = useRef<AnalyserNode | null>(null);
  const liveOutputAnalyserRef = useRef<AnalyserNode | null>(null);
  const visualizerContainerRef = useRef<HTMLDivElement>(null);
  const statusTextRef = useRef<HTMLParagraphElement>(null);
  const [visualizerState, setVisualizerState] = useState<'idle' | 'speaking' | 'listening'>('idle');
  const visualizerStateRef = useRef<'idle' | 'speaking' | 'listening'>('idle');

  // Recording Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Audio Refs for Resume Capability (Standard TTS)
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);
  
  // Chat Session Ref (Maintains Context)
  const chatSessionRef = useRef<Chat | null>(null);
  
  // For auto-scrolling to bottom
  const scrollRef = useRef<HTMLDivElement>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const startProcessing = async (userQuery: string) => {
    setHasInteraction(true);
    setProcessingStatus('processing');
    setSummaryContent('');
    // Clear previous map & infographic when new query starts
    setMapNodes([]); 
    setMapEdges([]);
    setInfographicImage(null);
    
    // Stop any playing audio and reset audio state when new search starts
    if (audioSourceRef.current) {
        audioSourceRef.current.onended = null;
        audioSourceRef.current.stop();
        audioSourceRef.current = null;
    }
    setIsPlayingAudio(false);
    audioBufferRef.current = null;
    pausedTimeRef.current = 0;

    try {
      // Initialize Chat Session if it doesn't exist
      if (!chatSessionRef.current) {
        chatSessionRef.current = ai.chats.create({
          model: 'gemini-3-pro-preview',
          config: {
            temperature: 0.7,
            systemInstruction: `You are an expert tutor for African students. 
User Language: ${language.nativeName} (${language.name}).
Your goal is to explain concepts clearly, using local analogies (e.g., mobile money, solar markets, local geography) where appropriate.
Always adapt your response style based on the instructions provided in the user's message.`
          }
        });
      }

      // Construct the message with mode-specific instructions appended
      let promptWithContext = "";
      
      if (inputMode === 'voice') {
        promptWithContext = `${userQuery}

[SYSTEM INSTRUCTION: RESPOND FOR AUDIO LISTENER]
- Context: The user is listening to this via TTS.
- Style: Podcast/Audiobook narration. Write for the ear, not the eye.
- Formatting: STRICTLY TEXT ONLY. No markdown, no bullets, no bold, no latex ($..$).
- Math: Speak formulas in words (e.g., "one divided by R-one").
- Structure: Short sentences. Use verbal cues like "Here's the thing..." or "Picture this...".
- Repetition: Briefly repeat key ideas in different words since the listener can't scroll back.
- Length: 200-300 words.`;
      } else {
        promptWithContext = `${userQuery}

[SYSTEM INSTRUCTION: RESPOND FOR TEXT READING]
- Context: The user is reading this on a screen.
- Style: Engaging educational article (TED-Ed / CrashCourse style).
- Formatting: Use Paragraphs. Use Bold for emphasis.
- Math: Use LaTeX format for formulas (e.g., $E=mc^2$).
- Structure: Clear flow. Avoid "Key Takeaways" headers or bullet lists unless absolutely necessary.
- Length: 250-400 words.`;
      }

      const response = await chatSessionRef.current.sendMessage({
        message: promptWithContext
      });

      if (response.text) {
          setSummaryContent(response.text);
      }
      setProcessingStatus('completed');

    } catch (error) {
      console.error("Error generating content:", error);
      setSummaryContent("I apologize, but I encountered an error while analyzing your request. Please check your connection and try again.");
      setProcessingStatus('completed');
    }
  };

  const handleSend = () => {
    if (!inputText.trim()) return;
    const q = inputText;
    setQuery(q);
    setInputText('');
    startProcessing(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    // If user is typing, switch to text mode
    setInputMode('text');
  };

  // --- Mind Map Demo & Generation ---
  
  const loadDemoSession = () => {
    setQuery("The Solar System");
    setHasInteraction(true);
    setProcessingStatus('completed');
    setSummaryContent("# The Solar System\n\nOur solar system consists of our star, the Sun, and everything bound to it by gravity.");
    setActiveTab('mindmap');
    
    // Demo Map Data
    const demoNodes: MapNode[] = [
        { id: "root", label: "Solar System", x: 0, y: 0, level: 0 },
        { id: "sun", label: "The Sun", x: 0, y: -200, level: 1 },
        { id: "planets", label: "Planets", x: 200, y: 0, level: 1 },
        { id: "dwarf", label: "Dwarf Planets", x: 0, y: 200, level: 1 },
        { id: "asteroids", label: "Asteroids", x: -200, y: 0, level: 1 },
        
        { id: "p1", label: "Mercury", x: 250, y: -50, level: 2 },
        { id: "p2", label: "Venus", x: 280, y: 0, level: 2 },
        { id: "p3", label: "Earth", x: 250, y: 50, level: 2 },
        { id: "p4", label: "Mars", x: 220, y: 100, level: 2 },
    ];
    
    const demoEdges: MapEdge[] = [
        { from: "root", to: "sun" },
        { from: "root", to: "planets" },
        { from: "root", to: "dwarf" },
        { from: "root", to: "asteroids" },
        { from: "planets", to: "p1" },
        { from: "planets", to: "p2" },
        { from: "planets", to: "p3" },
        { from: "planets", to: "p4" },
    ];

    setMapNodes(demoNodes);
    setMapEdges(demoEdges);
    setMapTransform({ x: 400, y: 300, k: 0.8 });
    // Reset Infographic
    setInfographicImage(null);
  };

  const generateMindMap = async () => {
    if (!query) return;
    setIsMapLoading(true);

    try {
        const prompt = `Generate a hierarchical concept map for the topic: "${query}".
        Return a JSON object with 'nodes' (list of {id, label}) and 'connections' (list of {from, to}).
        The 'id' should be short unique strings. 'label' should be 2-4 words max.
        Ensure there is one central node representing the main topic, connected to 3-5 main branches, and each branch has 1-3 sub-branches.
        Limit to 15 nodes total.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        nodes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.STRING },
                                    label: { type: Type.STRING }
                                },
                                required: ["id", "label"]
                            }
                        },
                        connections: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    from: { type: Type.STRING },
                                    to: { type: Type.STRING }
                                },
                                required: ["from", "to"]
                            }
                        }
                    },
                    required: ["nodes", "connections"]
                }
            }
        });

        if (response.text) {
            const data = JSON.parse(response.text);
            
            // Layout Algorithm: Radial Tree
            const nodes: MapNode[] = [];
            const centerX = 0;
            const centerY = 0;
            
            // Find root (node with no incoming connections or just the first one if unsure, usually logic dictates finding 0 in-degree or central concept)
            // For simplicity, we assume the first node is the central topic or we look for the query name.
            // Let's just place the first node at center.
            const rawNodes = data.nodes;
            const connections = data.connections;

            if (rawNodes.length > 0) {
                 // Place root
                 nodes.push({ ...rawNodes[0], x: centerX, y: centerY, level: 0 });
                 
                 // Find children of root
                 const level1Edges = connections.filter((c: any) => c.from === rawNodes[0].id);
                 const level1Count = level1Edges.length;
                 const radius1 = 200;

                 level1Edges.forEach((edge: any, i: number) => {
                     const angle = (i / level1Count) * 2 * Math.PI;
                     const node = rawNodes.find((n: any) => n.id === edge.to);
                     if (node) {
                         nodes.push({
                             ...node,
                             x: centerX + radius1 * Math.cos(angle),
                             y: centerY + radius1 * Math.sin(angle),
                             level: 1
                         });

                         // Find children of level 1
                         const level2Edges = connections.filter((c: any) => c.from === node.id);
                         const level2Count = level2Edges.length;
                         const radius2 = 120; // relative to parent
                         // Spread angle slightly around parent's outward angle
                         const wedge = Math.PI / 2; // 90 degrees wedge
                         const startAngle = angle - wedge/2;

                         level2Edges.forEach((edge2: any, j: number) => {
                             const subAngle = startAngle + (j + 1) * (wedge / (level2Count + 1));
                             const subNode = rawNodes.find((n: any) => n.id === edge2.to);
                             if (subNode) {
                                 // Absolute position
                                 nodes.push({
                                     ...subNode,
                                     x: (centerX + radius1 * Math.cos(angle)) + radius2 * Math.cos(subAngle),
                                     y: (centerY + radius1 * Math.sin(angle)) + radius2 * Math.sin(subAngle),
                                     level: 2
                                 });
                             }
                         });
                     }
                 });
            }
            
            setMapNodes(nodes);
            setMapEdges(connections);
            // Center view
            setMapTransform({ x: 400, y: 300, k: 0.8 }); // Assuming 800x600 container approx
        }
    } catch (e) {
        console.error("Mind map generation failed", e);
    } finally {
        setIsMapLoading(false);
    }
  };

  // --- Infographic Generation (Nano Banana) ---

  const generateInfographic = async () => {
    if (!query) return;
    setIsInfographicLoading(true);
    setInfographicImage(null);

    try {
        const prompt = `Create a high-quality, educational infographic poster about "${query}".
        Target Audience: Students.
        Key Requirement: The text inside the image MUST be in ${language.nativeName} (${language.name}).
        Style: Modern vector art, colorful, clear typography, easy to read, dark background to match app theme.
        Layout: Vertical layout, title at the top, 3-4 key sections with icons and brief text.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: prompt }]
            },
            config: {
                imageConfig: {
                    aspectRatio: "3:4"
                }
            }
        });

        // Loop through parts to find image
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    const base64Str = part.inlineData.data;
                    const mimeType = part.inlineData.mimeType || 'image/png';
                    setInfographicImage(`data:${mimeType};base64,${base64Str}`);
                    break;
                }
            }
        }
    } catch (e) {
        console.error("Infographic generation failed", e);
        alert("Could not generate infographic at this time.");
    } finally {
        setIsInfographicLoading(false);
    }
  };

  // --- Map Interactions ---
  const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      const scaleBy = 1.1;
      const newK = e.deltaY < 0 ? mapTransform.k * scaleBy : mapTransform.k / scaleBy;
      // Clamp zoom
      const finalK = Math.min(Math.max(0.2, newK), 3);
      setMapTransform(prev => ({ ...prev, k: finalK }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      // Check if clicking a node
      const target = e.target as Element;
      const nodeGroup = target.closest('.mindmap-node');
      
      if (nodeGroup) {
          const nodeId = nodeGroup.getAttribute('data-id');
          if (nodeId) {
            setDraggingNodeId(nodeId);
            setIsPanning(false);
          }
      } else {
          setIsPanning(true);
      }
      lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };

      if (isPanning) {
          setMapTransform(prev => ({
              ...prev,
              x: prev.x + dx,
              y: prev.y + dy
          }));
      } else if (draggingNodeId) {
          // Dragging a node - need to adjust dx/dy by scale
          setMapNodes(prev => prev.map(n => {
              if (n.id === draggingNodeId) {
                  return {
                      ...n,
                      x: n.x + dx / mapTransform.k,
                      y: n.y + dy / mapTransform.k
                  };
              }
              return n;
          }));
      }
  };

  const handleMouseUp = () => {
      setIsPanning(false);
      setDraggingNodeId(null);
  };

  // --- Live API (Conversational Mode) ---

  const startLiveSession = async () => {
    // Stop any standard playback first
    if (isPlayingAudio && audioSourceRef.current) {
        audioSourceRef.current.stop();
        setIsPlayingAudio(false);
    }

    setIsLiveMode(true);
    setLiveStatus('connecting');

    try {
        // 1. Setup Audio Contexts
        liveInputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        liveAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        
        // Setup Output Analyser
        const outputAnalyser = liveAudioContextRef.current.createAnalyser();
        outputAnalyser.fftSize = 256;
        outputAnalyser.smoothingTimeConstant = 0.5;
        outputAnalyser.connect(liveAudioContextRef.current.destination);
        liveOutputAnalyserRef.current = outputAnalyser;

        // 2. Get Microphone Stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // 3. Connect to Live API
        const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
                onopen: () => {
                    setLiveStatus('connected');
                    console.log("Live session connected");
                    
                    // Setup Input Stream Processing
                    if (!liveInputContextRef.current) return;
                    
                    const source = liveInputContextRef.current.createMediaStreamSource(stream);
                    const inputAnalyser = liveInputContextRef.current.createAnalyser();
                    inputAnalyser.fftSize = 256;
                    inputAnalyser.smoothingTimeConstant = 0.5;
                    source.connect(inputAnalyser);
                    liveInputAnalyserRef.current = inputAnalyser;

                    const scriptProcessor = liveInputContextRef.current.createScriptProcessor(4096, 1, 1);
                    
                    scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                        const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                        const pcmBlob = createBlob(inputData);
                        sessionPromise.then((session) => {
                            session.sendRealtimeInput({ media: pcmBlob });
                        });
                    };
                    
                    inputAnalyser.connect(scriptProcessor);
                    scriptProcessor.connect(liveInputContextRef.current.destination);
                },
                onmessage: async (message: LiveServerMessage) => {
                    // Handle Audio Output
                    const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                    
                    if (base64Audio && liveAudioContextRef.current) {
                        const ctx = liveAudioContextRef.current;
                        // Ensure context is running
                        if (ctx.state === 'suspended') await ctx.resume();

                        liveNextStartTimeRef.current = Math.max(
                            liveNextStartTimeRef.current,
                            ctx.currentTime
                        );

                        const audioBuffer = await decodeAudioData(
                            decode(base64Audio),
                            ctx,
                            24000,
                            1
                        );

                        const source = ctx.createBufferSource();
                        source.buffer = audioBuffer;
                        
                        // Connect source to analyser (which connects to destination)
                        if (liveOutputAnalyserRef.current) {
                            source.connect(liveOutputAnalyserRef.current);
                        } else {
                            source.connect(ctx.destination);
                        }
                        
                        source.addEventListener('ended', () => {
                            liveSourcesRef.current.delete(source);
                        });

                        source.start(liveNextStartTimeRef.current);
                        liveNextStartTimeRef.current += audioBuffer.duration;
                        liveSourcesRef.current.add(source);
                    }

                    // Handle Interruption
                    if (message.serverContent?.interrupted) {
                        console.log("Interrupted by user");
                        liveSourcesRef.current.forEach(source => {
                            try { source.stop(); } catch(e) {}
                        });
                        liveSourcesRef.current.clear();
                        if (liveAudioContextRef.current) {
                            liveNextStartTimeRef.current = liveAudioContextRef.current.currentTime;
                        }
                    }
                },
                onclose: () => {
                    console.log("Live session closed");
                    setLiveStatus('disconnected');
                    stopLiveSession();
                },
                onerror: (err) => {
                    console.error("Live session error:", err);
                    setLiveStatus('disconnected');
                    stopLiveSession();
                }
            },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
                },
                systemInstruction: `You are a friendly, enthusiastic tutor for an African student. 
User Language: ${language.nativeName}.
Current Topic: ${query || "General Learning"}.
Keep responses concise (1-3 sentences), conversational, and encourage the student to speak. 
When interrupted, stop immediately and listen.
Use local analogies where appropriate.`,
            }
        });

        liveSessionRef.current = sessionPromise;

    } catch (error) {
        console.error("Failed to start live session:", error);
        setLiveStatus('disconnected');
        setIsLiveMode(false);
        alert("Failed to start live conversation. Please check microphone permissions.");
    }
  };

  const stopLiveSession = async () => {
    // Stop microphone tracks
    if (liveInputContextRef.current) {
       liveInputContextRef.current.close();
       liveInputContextRef.current = null;
    }
    
    // Stop playback
    if (liveAudioContextRef.current) {
        liveSourcesRef.current.forEach(s => s.stop());
        liveSourcesRef.current.clear();
        liveAudioContextRef.current.close();
        liveAudioContextRef.current = null;
    }

    // Close session
    if (liveSessionRef.current) {
        liveSessionRef.current.then((session: any) => {
             if (session && session.close) session.close();
        });
        liveSessionRef.current = null;
    }

    setIsLiveMode(false);
    setLiveStatus('disconnected');
  };

  // --- Visualizer Animation Loop ---
  useEffect(() => {
    if (!isLiveMode) return;
    
    let animationId: number;
    const loop = () => {
        const inVol = getVolume(liveInputAnalyserRef.current);
        const outVol = getVolume(liveOutputAnalyserRef.current);
        
        if (visualizerContainerRef.current) {
            // Determine active state for coloring
            const isSpeaking = outVol > 0.01;
            const isListening = inVol > 0.01;
            
            let state: 'idle' | 'speaking' | 'listening' = 'idle';
            if (isSpeaking) state = 'speaking';
            else if (isListening) state = 'listening';
            
            if (state !== visualizerStateRef.current) {
                visualizerStateRef.current = state;
                setVisualizerState(state);
            }

            // Update text indicator (throttled visually via direct DOM update)
            if (statusTextRef.current) {
                if (state === 'speaking') statusTextRef.current.innerText = "AfroLearn is speaking...";
                else if (state === 'listening') statusTextRef.current.innerText = "Listening...";
                else if (liveStatus === 'connected') statusTextRef.current.innerText = "Thinking...";
                else statusTextRef.current.innerText = "Connecting...";
            }

            // Calculate active volume for visual scale
            const activeVol = Math.max(inVol, outVol);
            // Amplify for visibility
            const displayVol = Math.min(activeVol * 4, 1); 
            
            // Update CSS variables for bars
            visualizerContainerRef.current.style.setProperty('--vol', displayVol.toString());
        }
        
        animationId = requestAnimationFrame(loop);
    };
    
    loop();
    
    return () => {
        cancelAnimationFrame(animationId);
    };
  }, [isLiveMode, liveStatus]);

  // --- Audio Generation & Playback (Standard TTS) ---

  const playAudioOverview = async () => {
    // If loading, do nothing
    if (isAudioLoading) return;

    // Ensure Audio Context exists
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }

    // Always resume context (browser policy)
    if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
    }

    // PAUSE LOGIC: If playing, stop and record time
    if (isPlayingAudio) {
        if (audioSourceRef.current) {
            // Remove onended listener to prevent resetting the pausedTime
            audioSourceRef.current.onended = null;
            audioSourceRef.current.stop();
            audioSourceRef.current = null;
            
            // Calculate elapsed time
            const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
            pausedTimeRef.current += elapsed;
        }
        setIsPlayingAudio(false);
        return;
    }

    // RESUME LOGIC: If we have buffer, play from paused time
    if (audioBufferRef.current) {
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBufferRef.current;
        source.connect(audioContextRef.current.destination);
        
        source.onended = () => {
            setIsPlayingAudio(false);
            pausedTimeRef.current = 0; // Reset when finished naturally
        };

        audioSourceRef.current = source;
        // Start from stored pause time
        source.start(0, pausedTimeRef.current);
        startTimeRef.current = audioContextRef.current.currentTime;
        setIsPlayingAudio(true);
        return;
    }

    // GENERATE LOGIC: Fetch new audio
    if (!summaryContent) return;

    try {
        setIsAudioLoading(true);
        
        // In Voice Mode, text is already optimized. In Text Mode, we strip markdown.
        const cleanText = summaryContent.replace(/[*#_`]/g, '');
        const textToSpeak = cleanText.slice(0, 800) + (cleanText.length > 800 ? "..." : "");

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: { parts: [{ text: textToSpeak }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: 'Kore' },
                    },
                },
            },
        });

        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        
        if (base64Audio) {
            // Make sure context exists (typescript check)
            if (!audioContextRef.current) return;

            const audioBuffer = await decodeAudioData(
                decode(base64Audio),
                audioContextRef.current,
                24000,
                1,
            );

            // Cache buffer and reset time
            audioBufferRef.current = audioBuffer;
            pausedTimeRef.current = 0;

            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            
            source.onended = () => {
                setIsPlayingAudio(false);
                pausedTimeRef.current = 0;
            };
            
            audioSourceRef.current = source;
            source.start(0, 0);
            startTimeRef.current = audioContextRef.current.currentTime;
            setIsPlayingAudio(true);
        } else {
            console.error("No audio data returned");
            alert("Could not generate audio at this time.");
        }

    } catch (error) {
        console.error("Error generating speech:", error);
        alert("Error generating speech. Please try again.");
    } finally {
        setIsAudioLoading(false);
    }
  };

  // --- File Upload Handlers ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const processFiles = (files: File[]) => {
    const newFiles = files.map(f => ({
      name: f.name,
      type: f.type,
      size: f.size
    }));
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
    
    // Set a generic query based on files if one hasn't been set yet
    const autoQuery = `Analyze ${newFiles[0].name}${newFiles.length > 1 ? ` and ${newFiles.length - 1} other files` : ''}`;
    if (!query) {
        setQuery(autoQuery);
        startProcessing(autoQuery);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // --- Voice Handlers (Real Transcription) ---

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        
        reader.onloadend = async () => {
           try {
              setIsTranscribing(true);
              const base64data = reader.result as string;
              // Remove header "data:audio/webm;base64,"
              const base64Content = base64data.split(',')[1];
              
              const response = await ai.models.generateContent({
                 model: "gemini-2.5-flash",
                 contents: {
                    parts: [
                       { inlineData: { mimeType: mimeType, data: base64Content } },
                       { text: `Transcribe the spoken audio into text. The language is likely ${language.name} or English.
                       
                       Context: An African student asking a question to an AI tutor.
                       Instructions:
                       - Transcribe the audio.
                       - Correct any spelling or grammatical errors (e.g. "soler power" -> "solar power").
                       - If terms are ambiguous, prioritize academic/educational terminology.
                       Return only the transcription text, no other commentary.` }
                    ]
                 }
              });

              if (response.text) {
                 setInputText(response.text.trim());
                 // Switch to voice mode since the user spoke
                 setInputMode('voice');
              }
           } catch (error) {
              console.error("Transcription error", error);
              alert("Could not transcribe audio.");
           } finally {
              setIsTranscribing(false);
              // Stop all tracks to release mic
              stream.getTracks().forEach(track => track.stop());
           }
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Could not access microphone. Please ensure permissions are granted.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
  };

  useEffect(() => {
    if (processingStatus === 'completed' && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [processingStatus]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
        }
        if (audioContextRef.current) {
            audioContextRef.current.close();
        }
        stopLiveSession();
    };
  }, []);

  return (
    <div className="flex flex-col h-[100dvh] bg-nl-bg text-nl-text overflow-hidden font-sans relative">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        className="hidden" 
        multiple 
      />

      {/* Live Mode Overlay */}
      {isLiveMode && (
          <div className="absolute inset-0 z-50 bg-nl-bg/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
              <button 
                onClick={stopLiveSession}
                className="absolute top-6 right-6 p-3 rounded-full bg-nl-surface hover:bg-nl-surfaceHover text-nl-textDim hover:text-white transition-colors"
              >
                  <X size={24} />
              </button>

              <div className="flex flex-col items-center max-w-md text-center">
                  
                  {/* Dynamic Visualizer */}
                  <div 
                    ref={visualizerContainerRef}
                    className="flex items-center justify-center gap-2 h-40 mb-8"
                  >
                        {/* 5 Bars for visualization */}
                        {[0, 1, 2, 3, 4].map(i => (
                            <div 
                                key={i}
                                className={`w-4 rounded-full transition-all duration-75 origin-bottom 
                                    ${visualizerState === 'speaking' ? 'bg-brand-500' : ''}
                                    ${visualizerState === 'listening' ? 'bg-blue-500' : ''}
                                    ${visualizerState === 'idle' ? 'bg-nl-border animate-visualizer-idle' : ''}
                                `}
                                style={{
                                    height: `calc(1rem + (6rem * var(--vol, 0.1) * ${[0.6, 0.8, 1, 0.8, 0.6][i]}))`,
                                    // Subtle variation in height update for organic feel
                                    transitionDelay: `${i * 20}ms`
                                }}
                            />
                        ))}
                        
                        <style>{`
                            @keyframes visualizer-idle {
                                0%, 100% { opacity: 0.5; height: 1rem; }
                                50% { opacity: 1; height: 2rem; }
                            }
                            .animate-visualizer-idle {
                                animation: visualizer-idle 2s infinite;
                            }
                        `}</style>
                  </div>

                  <h2 ref={statusTextRef} className="text-2xl font-bold text-white mb-2 transition-all">
                      Connecting...
                  </h2>
                  <p className="text-nl-textDim mb-8">
                      {liveStatus === 'connected' 
                        ? "Conversation is active. Tap below to end." 
                        : "Establishing secure real-time connection..."}
                  </p>
                  
                  {liveStatus === 'connected' && (
                     <div className="flex gap-4">
                        <button 
                            onClick={stopLiveSession}
                            className="px-8 py-4 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/50 rounded-full font-semibold transition-colors flex items-center gap-2"
                        >
                            <Phone size={20} className="rotate-135" />
                            End Call
                        </button>
                     </div>
                  )}
              </div>
          </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-nl-bg border-b border-nl-border/50 shrink-0 z-20">
        <div className="flex items-center gap-3 md:gap-4">
          <button 
            onClick={onBack}
            className="w-8 h-8 md:w-10 md:h-10 rounded-full hover:bg-nl-surfaceHover flex items-center justify-center text-nl-textDim hover:text-nl-text transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2 overflow-hidden">
             <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-500 to-brand-700 flex shrink-0 items-center justify-center text-[10px] font-bold text-white">AL</div>
             <span className="text-sm font-medium text-nl-textDim truncate">{hasInteraction ? (query || 'Session Analysis') : 'Untitled session'}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
           {/* Mobile Panel Toggles */}
           <button 
             onClick={() => setMobilePanel('sources')}
             className="lg:hidden p-2 text-nl-textDim hover:text-nl-text hover:bg-nl-surfaceHover rounded-full transition-colors"
           >
              <PanelLeft size={20} />
           </button>
           <button 
             onClick={() => setMobilePanel('studio')}
             className="xl:hidden p-2 text-nl-textDim hover:text-nl-text hover:bg-nl-surfaceHover rounded-full transition-colors"
           >
              <PanelRight size={20} />
           </button>

           <button className="hidden md:flex items-center gap-2 px-4 py-2 bg-nl-surface rounded-full border border-nl-border text-sm font-medium hover:bg-nl-surfaceHover transition-colors">
              <Share size={16} />
              <span>Share</span>
           </button>
           <button className="p-2 text-nl-textDim hover:text-nl-text hover:bg-nl-surfaceHover rounded-full transition-colors">
             <Settings size={20} />
           </button>
           <div className="w-8 h-8 rounded-full bg-blue-900 text-blue-200 flex items-center justify-center font-semibold text-xs border border-blue-700 ml-2 hidden sm:flex">
              JS
           </div>
        </div>
      </header>

      {/* Main Layout Grid */}
      <div className="flex-1 overflow-hidden p-0 md:p-4 grid grid-cols-1 lg:grid-cols-12 gap-0 md:gap-4 relative">
        
        {/* Left Sidebar - Sources */}
        <aside className={`
            bg-nl-surface flex-col border-r md:border border-nl-border overflow-hidden
            lg:col-span-3 lg:flex lg:static lg:rounded-3xl lg:z-auto
            ${mobilePanel === 'sources' ? 'absolute inset-0 z-30 flex' : 'hidden'}
        `}>
           <div className="p-4 flex items-center justify-between border-b border-nl-border/50 shrink-0">
             <span className="font-medium text-nl-text">Sources</span>
             <div className="flex items-center gap-1">
               <button className="p-1 hover:bg-nl-surfaceHover rounded text-nl-textDim">
                 <MoreVertical size={16} />
               </button>
               <button onClick={() => setMobilePanel('none')} className="lg:hidden p-1 hover:bg-nl-surfaceHover rounded text-nl-textDim">
                 <X size={20} />
               </button>
             </div>
           </div>
           
           <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <button 
                onClick={triggerFileInput}
                className="w-full py-3 border border-nl-border rounded-full flex items-center justify-center gap-2 text-brand-400 hover:bg-nl-surfaceHover transition-colors text-sm font-medium"
              >
                <Plus size={16} />
                <span>Add sources</span>
              </button>
              
              <div className="bg-nl-bg/50 rounded-2xl p-4 border border-nl-border/50">
                 <div className="flex items-center gap-2 text-brand-400 mb-2">
                    <Zap size={14} className="fill-current" />
                    <span className="text-xs font-bold uppercase tracking-wider">Try Deep Study</span>
                 </div>
                 <p className="text-xs text-nl-textDim leading-relaxed">
                   Get an in-depth report on {language.nativeName} history and culture with new sources!
                 </p>
              </div>

              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-nl-textDim" size={16} />
                <input 
                  type="text" 
                  placeholder="Search web for sources" 
                  className="w-full bg-nl-bg rounded-xl py-3 pl-10 pr-4 text-sm text-nl-text border border-nl-border focus:border-brand-500 focus:outline-none transition-colors"
                />
              </div>

              {hasInteraction ? (
                <div className="mt-4">
                    <p className="text-xs font-semibold text-nl-textDim uppercase tracking-wider mb-2">Active Sources</p>
                    <div className="space-y-2">
                        {uploadedFiles.length === 0 && (
                            <SourceItem icon={<Globe size={14} />} title="Gemini Knowledge Base" source="google.com" />
                        )}
                        {uploadedFiles.map((file, idx) => (
                           <SourceItem 
                              key={idx} 
                              icon={<FileText size={14} />} 
                              title={file.name} 
                              source={`${(file.size / 1024).toFixed(1)} KB`} 
                           />
                        ))}
                    </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center mt-12 opacity-50">
                    <FileText size={48} className="text-nl-border mb-4" />
                    <p className="text-sm text-nl-textDim px-4">
                    Saved sources will appear here.
                    </p>
                </div>
              )}
           </div>
        </aside>

        {/* Center Panel - Main Interaction Area */}
        <main className="col-span-1 lg:col-span-9 xl:col-span-6 bg-nl-bg md:bg-nl-surface md:rounded-3xl md:border border-nl-border flex flex-col relative overflow-hidden h-full">
           
           <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar relative">
              {!hasInteraction ? (
                // Empty State & Drop Zone
                <div 
                    className="min-h-full flex flex-col items-center justify-center p-4 md:p-12 pb-24 md:pb-12"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500/20 to-brand-700/20 flex items-center justify-center mb-6 text-brand-500 shrink-0">
                        <Bot size={32} />
                    </div>
                    
                    <h1 className="text-2xl md:text-3xl font-medium text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-nl-text to-nl-textDim">
                        What would you like to learn about?
                    </h1>

                    {/* Central Search Box */}
                    <div className="w-full max-w-xl mb-8 relative z-10">
                        <div className="relative group rounded-2xl p-[1px] bg-gradient-to-r from-brand-500/50 via-nl-border to-brand-500/50 hover:via-brand-400 transition-all duration-500">
                            <div className="bg-nl-bg rounded-2xl p-2 flex items-center">
                                <Search className="text-nl-textDim ml-3 shrink-0" size={20} />
                                <input 
                                type="text"
                                value={inputText}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown} 
                                placeholder="Enter a topic (e.g., 'Impact of mobile money')"
                                className="flex-1 bg-transparent border-none focus:outline-none px-4 py-3 text-nl-text placeholder-nl-textDim min-w-0"
                                />
                                <button 
                                    onClick={handleSend}
                                    className="p-2 bg-nl-surfaceHover rounded-xl text-nl-textDim hover:text-white transition-colors shrink-0"
                                >
                                <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Upload Options Box - Acts as Drag Target */}
                    <div className={`
                        w-full max-w-2xl border border-dashed rounded-3xl p-6 md:p-8 mt-4 bg-nl-bg/20 transition-all duration-200
                        ${isDragging 
                            ? 'border-brand-500 bg-brand-500/10 scale-[1.02]' 
                            : 'border-nl-border'
                        }
                    `}>
                        <p className={`text-center mb-6 md:mb-8 text-lg font-medium transition-colors ${isDragging ? 'text-brand-400' : 'text-nl-textDim'}`}>
                            {isDragging ? 'Drop files to analyze' : 'or drop your files here'}
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 pointer-events-none md:pointer-events-auto">
                            <UploadOption icon={<Upload size={18}/>} label="Upload files" onClick={triggerFileInput} />
                            <UploadOption icon={<Link size={18}/>} label="Websites" color="text-red-400" />
                            <UploadOption icon={<HardDrive size={18}/>} label="Drive" />
                            <UploadOption icon={<Copy size={18}/>} label="Copied text" />
                        </div>

                        {/* DEMO BUTTON */}
                        <div className="col-span-2 md:col-span-4 flex justify-center mt-4">
                             <button 
                                onClick={loadDemoSession}
                                className="text-xs text-brand-400 hover:text-brand-300 underline underline-offset-4 flex items-center gap-1"
                             >
                                <Zap size={12} fill="currentColor" />
                                Try Mind Map Demo
                             </button>
                        </div>
                    </div>
                </div>
              ) : (
                // Interaction / Response View
                <div className="min-h-full flex flex-col p-4 md:p-8 pb-24">
                   {/* User Query */}
                   <div className="flex justify-end mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="bg-nl-surfaceHover border border-nl-border rounded-2xl rounded-tr-sm px-6 py-4 max-w-[85%] md:max-w-[70%]">
                         <p className="text-nl-text text-lg">{query}</p>
                      </div>
                   </div>

                   {/* System Response Area */}
                   <div className="w-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">
                       
                       {/* Status Indicator */}
                       <div className="flex items-center gap-3 mb-4 pl-1">
                          {processingStatus === 'processing' ? (
                             <>
                                <div className="relative">
                                    <div className="absolute inset-0 bg-brand-500/50 blur animate-pulse rounded-full"></div>
                                    <Activity size={18} className="text-brand-400 relative z-10 animate-spin-slow" />
                                </div>
                                <span className="text-sm font-medium text-nl-textDim animate-pulse">Gemini 3 is thinking...</span>
                             </>
                          ) : (
                             <>
                                <CheckCircle2 size={18} className="text-green-400" />
                                <span className="text-sm font-medium text-green-400">Processed by Gemini 3 Pro</span>
                             </>
                          )}
                       </div>

                       {/* Generated Content Card */}
                       {processingStatus === 'completed' && (
                           <div className="bg-nl-bg border border-nl-border rounded-3xl overflow-hidden shadow-xl shadow-black/20">
                                
                                {/* Tabs Header */}
                                <div className="flex items-center gap-1 p-2 border-b border-nl-border bg-nl-surface overflow-x-auto scrollbar-hide">
                                    <TabButton active={activeTab === 'summary'} onClick={() => setActiveTab('summary')} icon={<FileText size={16}/>} label="Summary" />
                                    <TabButton active={activeTab === 'audio'} onClick={() => { setActiveTab('audio'); playAudioOverview(); }} icon={<AudioWaveform size={16}/>} label="Audio Overview" />
                                    <TabButton active={activeTab === 'mindmap'} onClick={() => { setActiveTab('mindmap'); if(mapNodes.length===0) generateMindMap(); }} icon={<Network size={16}/>} label="Mind Map" />
                                    <TabButton active={activeTab === 'infographic'} onClick={() => { setActiveTab('infographic'); if(!infographicImage) generateInfographic(); }} icon={<BarChart3 size={16}/>} label="Infographic" />
                                </div>

                                {/* Content Body */}
                                <div className="min-h-[400px] bg-nl-bg/50">
                                    {activeTab === 'summary' && (
                                        <div className="p-6 md:p-8 animate-in fade-in duration-300">
                                            <div className="flex justify-between items-start mb-4">
                                                <h3 className="text-xl font-bold text-brand-100 capitalize">{query}</h3>
                                                <button 
                                                    onClick={playAudioOverview}
                                                    disabled={isAudioLoading}
                                                    className={`p-2 rounded-full border transition-all ${isPlayingAudio ? 'bg-brand-500 text-white border-brand-500' : 'border-nl-border text-nl-textDim hover:text-nl-text hover:bg-nl-surfaceHover'}`}
                                                    title={isPlayingAudio ? "Stop Explanation" : "Play Explanation"}
                                                >
                                                    {isAudioLoading ? <Loader2 size={20} className="animate-spin" /> : (isPlayingAudio ? <Pause size={20} /> : <Volume2 size={20} />)}
                                                </button>
                                            </div>
                                            <div className="max-w-none space-y-4">
                                                <ReactMarkdown 
                                                    components={{
                                                        h1: ({node, ...props}) => <h1 className="text-2xl font-bold text-brand-100 mb-4 mt-6" {...props} />,
                                                        h2: ({node, ...props}) => <h2 className="text-xl font-bold text-brand-100 mb-3 mt-5" {...props} />,
                                                        h3: ({node, ...props}) => <h3 className="text-lg font-bold text-brand-200 mb-2 mt-4" {...props} />,
                                                        p: ({node, ...props}) => <p className="text-nl-textDim mb-4 leading-relaxed" {...props} />,
                                                        ul: ({node, ...props}) => <ul className="list-disc list-outside ml-5 space-y-1 mb-4 text-nl-textDim" {...props} />,
                                                        ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-5 space-y-1 mb-4 text-nl-textDim" {...props} />,
                                                        li: ({node, ...props}) => <li className="pl-1" {...props} />,
                                                        strong: ({node, ...props}) => <strong className="font-bold text-brand-400" {...props} />,
                                                        hr: ({node, ...props}) => <hr className="border-nl-border my-6" {...props} />,
                                                        blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-brand-500 pl-4 py-1 my-4 bg-nl-surface/50 rounded-r italic text-nl-text" {...props} />,
                                                        code: ({node, ...props}) => <code className="bg-nl-surfaceHover text-brand-300 px-1 py-0.5 rounded text-sm font-mono border border-nl-border" {...props} />
                                                    }}
                                                >
                                                    {/* Simple regex to replace latex style math $...$ with code blocks for better visibility */}
                                                    {summaryContent.replace(/\$([^\$]+)\$/g, '`$1`')}
                                                </ReactMarkdown>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'audio' && (
                                        <div className="p-6 md:p-8 flex flex-col items-center justify-center h-[400px] animate-in fade-in duration-300">
                                            <div 
                                                onClick={playAudioOverview}
                                                className={`
                                                    w-32 h-32 rounded-full border-4 flex items-center justify-center mb-6 relative group cursor-pointer transition-all
                                                    ${isPlayingAudio ? 'border-brand-500 bg-brand-900/20' : 'bg-nl-surface border-nl-border hover:border-brand-500'}
                                                `}
                                            >
                                                <div className={`absolute inset-0 bg-brand-500/20 rounded-full blur-xl transition-opacity ${isPlayingAudio ? 'opacity-100 animate-pulse' : 'opacity-0 group-hover:opacity-100'}`}></div>
                                                {isAudioLoading ? (
                                                    <Loader2 size={40} className="text-brand-400 animate-spin" />
                                                ) : isPlayingAudio ? (
                                                    <Pause size={40} className="ml-0 text-brand-400" />
                                                ) : (
                                                    <Play size={40} className="ml-2 text-nl-text group-hover:text-brand-400 transition-colors" />
                                                )}
                                            </div>
                                            <h3 className="text-lg font-medium text-nl-text mb-2">
                                                {isAudioLoading ? "Generating Audio..." : (isPlayingAudio ? "Playing Overview..." : "Listen to Overview")}
                                            </h3>
                                            <p className="text-sm text-nl-textDim mb-8 text-center max-w-md">
                                                A clear, vocal summary of <span className="text-brand-400">"{query}"</span> generated by Gemini 2.5 Flash TTS.
                                            </p>
                                        </div>
                                    )}

                                    {activeTab === 'mindmap' && (
                                        <div className="relative w-full h-[500px] bg-nl-surface/50 overflow-hidden cursor-move group select-none">
                                            {isMapLoading && (
                                                <div className="absolute inset-0 flex items-center justify-center z-10 bg-nl-bg/50 backdrop-blur-sm">
                                                    <div className="flex flex-col items-center">
                                                        <Loader2 size={32} className="text-brand-400 animate-spin mb-2" />
                                                        <span className="text-sm font-medium text-nl-text">Designing map...</span>
                                                    </div>
                                                </div>
                                            )}
                                            
                                            {/* Interactive SVG Layer */}
                                            <svg 
                                                ref={mapSvgRef}
                                                className="w-full h-full"
                                                onMouseDown={handleMouseDown}
                                                onMouseMove={handleMouseMove}
                                                onMouseUp={handleMouseUp}
                                                onMouseLeave={handleMouseUp}
                                                onWheel={handleWheel}
                                            >
                                                <g transform={`translate(${mapTransform.x}, ${mapTransform.y}) scale(${mapTransform.k})`}>
                                                    {/* Connections */}
                                                    {mapEdges.map((edge, i) => {
                                                        const fromNode = mapNodes.find(n => n.id === edge.from);
                                                        const toNode = mapNodes.find(n => n.id === edge.to);
                                                        if (!fromNode || !toNode) return null;
                                                        
                                                        return (
                                                            <line
                                                                key={i}
                                                                x1={fromNode.x}
                                                                y1={fromNode.y}
                                                                x2={toNode.x}
                                                                y2={toNode.y}
                                                                stroke="#444746"
                                                                strokeWidth="1.5"
                                                                opacity="0.6"
                                                            />
                                                        );
                                                    })}

                                                    {/* Nodes */}
                                                    {mapNodes.map((node) => (
                                                        <g 
                                                            key={node.id} 
                                                            className="mindmap-node cursor-grab active:cursor-grabbing hover:opacity-90"
                                                            data-id={node.id}
                                                            transform={`translate(${node.x}, ${node.y})`}
                                                        >
                                                            {/* Node Shape */}
                                                            {node.level === 0 ? (
                                                                <circle r="40" fill="#ce9242" stroke="#fff" strokeWidth="2" className="shadow-lg" />
                                                            ) : node.level === 1 ? (
                                                                <rect x="-60" y="-20" width="120" height="40" rx="20" fill="#2D2E31" stroke="#ce9242" strokeWidth="1" />
                                                            ) : (
                                                                <rect x="-50" y="-15" width="100" height="30" rx="15" fill="#1E1F20" stroke="#444746" strokeWidth="1" />
                                                            )}
                                                            
                                                            {/* Label */}
                                                            <text
                                                                dy=".3em"
                                                                textAnchor="middle"
                                                                fill={node.level === 0 ? "#fff" : "#E3E3E3"}
                                                                fontSize={node.level === 0 ? "12" : "10"}
                                                                fontWeight="500"
                                                                style={{pointerEvents: 'none'}}
                                                            >
                                                                {node.label.length > 15 ? node.label.substring(0, 12) + '...' : node.label}
                                                            </text>
                                                        </g>
                                                    ))}
                                                </g>
                                            </svg>
                                            
                                            {/* Map Controls Overlay */}
                                            <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                                                <button 
                                                    onClick={() => setMapTransform(prev => ({ ...prev, k: Math.min(prev.k * 1.2, 3) }))}
                                                    className="p-2 bg-nl-surface border border-nl-border rounded-lg text-nl-textDim hover:text-nl-text hover:bg-nl-surfaceHover"
                                                >
                                                    <ZoomIn size={20} />
                                                </button>
                                                <button 
                                                     onClick={() => setMapTransform(prev => ({ ...prev, k: Math.max(prev.k / 1.2, 0.2) }))}
                                                    className="p-2 bg-nl-surface border border-nl-border rounded-lg text-nl-textDim hover:text-nl-text hover:bg-nl-surfaceHover"
                                                >
                                                    <ZoomOut size={20} />
                                                </button>
                                                <button 
                                                    onClick={() => setMapTransform({ x: 400, y: 300, k: 0.8 })}
                                                    className="p-2 bg-nl-surface border border-nl-border rounded-lg text-nl-textDim hover:text-nl-text hover:bg-nl-surfaceHover"
                                                    title="Reset View"
                                                >
                                                    <Move size={20} />
                                                </button>
                                                <button 
                                                    onClick={generateMindMap}
                                                    className="p-2 bg-nl-surface border border-nl-border rounded-lg text-nl-textDim hover:text-nl-text hover:bg-nl-surfaceHover mt-2"
                                                    title="Regenerate Map"
                                                >
                                                    <RefreshCw size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'infographic' && (
                                        <div className="relative w-full h-[500px] md:h-[600px] bg-nl-surface/50 flex flex-col items-center justify-center p-4">
                                            {isInfographicLoading ? (
                                                <div className="flex flex-col items-center">
                                                    <Loader2 size={40} className="text-brand-400 animate-spin mb-4" />
                                                    <h3 className="text-lg font-medium text-white mb-2">Designing Infographic...</h3>
                                                    <p className="text-sm text-nl-textDim text-center max-w-xs">
                                                        Using Gemini 2.5 Flash to create a localized educational poster in {language.name}.
                                                    </p>
                                                </div>
                                            ) : infographicImage ? (
                                                <div className="relative w-full h-full flex items-center justify-center">
                                                    <img 
                                                        src={infographicImage} 
                                                        alt={`Infographic about ${query}`}
                                                        className="max-h-full max-w-full rounded-lg shadow-2xl border border-nl-border"
                                                    />
                                                    <div className="absolute top-4 right-4 flex gap-2">
                                                        <a 
                                                            href={infographicImage} 
                                                            download={`AfroLearn-${query.replace(/\s+/g, '-')}-infographic.png`}
                                                            className="p-2 bg-nl-surface/80 backdrop-blur-sm hover:bg-white text-white hover:text-black rounded-full transition-colors shadow-lg"
                                                            title="Download Image"
                                                        >
                                                            <Download size={20} />
                                                        </a>
                                                        <button 
                                                            onClick={generateInfographic}
                                                            className="p-2 bg-nl-surface/80 backdrop-blur-sm hover:bg-white text-white hover:text-black rounded-full transition-colors shadow-lg"
                                                            title="Regenerate"
                                                        >
                                                            <RefreshCw size={20} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col items-center text-center">
                                                    <BarChart3 size={48} className="text-nl-border mb-4" />
                                                    <h3 className="text-lg font-medium text-nl-text mb-2">Visual Learning</h3>
                                                    <p className="text-sm text-nl-textDim max-w-sm mb-6">
                                                        Generate a custom infographic about "{query}" with text in {language.name}.
                                                    </p>
                                                    <button 
                                                        onClick={generateInfographic}
                                                        className="px-6 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-full font-semibold transition-colors flex items-center gap-2"
                                                    >
                                                        <Zap size={18} fill="currentColor" />
                                                        Generate Infographic
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Footer Action Controls - Context aware based on tab */}
                                <div className="p-4 border-t border-nl-border bg-nl-surface flex flex-wrap gap-2 items-center justify-between">
                                     <div className="flex gap-2">
                                        {activeTab === 'summary' && (
                                            <>
                                            <ActionButton icon={isAudioLoading ? <Loader2 size={16} className="animate-spin"/> : <Play size={16}/>} label="Play Voice" onClick={playAudioOverview} />
                                            <ActionButton icon={<Download size={16}/>} label="Download" />
                                            </>
                                        )}
                                        {activeTab === 'audio' && (
                                             <ActionButton icon={<Download size={16}/>} label="Download MP3" />
                                        )}
                                        {activeTab === 'infographic' && infographicImage && (
                                             <ActionButton icon={<Download size={16}/>} label="Download PNG" />
                                        )}
                                     </div>
                                     
                                     <div className="flex gap-2">
                                        <button className="p-2 hover:bg-nl-surfaceHover rounded-lg text-nl-textDim hover:text-nl-text transition-colors">
                                            <Share size={18} />
                                        </button>
                                        <button className="p-2 hover:bg-nl-surfaceHover rounded-lg text-nl-textDim hover:text-nl-text transition-colors">
                                            <MoreVertical size={18} />
                                        </button>
                                     </div>
                                </div>
                           </div>
                       )}
                   </div>
                </div>
              )}
           </div>

           {/* Bottom Input Bar - Sticky */}
           <div className="shrink-0 p-4 border-t border-nl-border/50 bg-nl-surface z-10 w-full safe-pb-4">
              <div className={`relative bg-nl-bg rounded-[2rem] border transition-all w-full flex items-center gap-2 shadow-sm
                  ${isRecording ? 'border-brand-500 ring-1 ring-brand-500/50' : 'border-nl-border focus-within:border-brand-500/50 focus-within:ring-1 focus-within:ring-brand-500/20'}
                  pl-4 pr-2 py-2
              `}>
                 
                 {isRecording ? (
                     <div className="flex-1 flex items-center gap-3 overflow-hidden h-[40px]">
                         <div className="flex items-center gap-1 h-full px-2">
                             {[1,2,3,4,5].map(i => (
                                 <div key={i} className="w-1 bg-brand-500 rounded-full animate-pulse" style={{height: `${40 + Math.random() * 60}%`, animationDuration: `${0.5 + Math.random()}s`}}></div>
                             ))}
                         </div>
                         <span className="text-brand-500 font-medium animate-pulse">Listening...</span>
                     </div>
                 ) : isTranscribing ? (
                     <div className="flex-1 flex items-center gap-3 overflow-hidden h-[40px] px-2">
                        <Loader2 size={18} className="text-brand-500 animate-spin" />
                        <span className="text-brand-500 font-medium animate-pulse">Transcribing...</span>
                     </div>
                 ) : (
                     <>
                        <button 
                            onClick={triggerFileInput}
                            className="p-2 bg-nl-surface rounded-full border border-nl-border text-nl-textDim flex items-center justify-center shrink-0 cursor-pointer hover:bg-nl-surfaceHover transition-colors"
                        >
                            <Plus size={18} />
                        </button>
                        
                        {/* Live Conversation Button */}
                         <button 
                            onClick={startLiveSession}
                            title="Start Live Conversation"
                            className="p-2 bg-nl-surface rounded-full border border-nl-border text-brand-400 flex items-center justify-center shrink-0 cursor-pointer hover:bg-nl-surfaceHover transition-colors ml-1"
                        >
                            <AudioWaveform size={18} />
                        </button>

                        <input 
                            type="text"
                            value={inputText}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            className="flex-1 bg-transparent border-none focus:outline-none text-nl-text placeholder-nl-textDim py-2 text-sm md:text-base min-w-0 ml-2"
                            placeholder="Ask a question or say 'I want to learn...'"
                            disabled={processingStatus === 'processing'}
                        />
                     </>
                 )}

                 <div className="flex items-center gap-1 shrink-0">
                    {/* Voice Input */}
                    <button 
                        onClick={toggleRecording}
                        className={`p-2.5 rounded-full transition-colors ${isRecording ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20' : 'text-nl-textDim hover:text-nl-text hover:bg-nl-surfaceHover'}`}
                        disabled={isTranscribing}
                    >
                        {isRecording ? <Square size={20} fill="currentColor" /> : <Mic size={20} />}
                    </button>
                    
                    {/* Send Button */}
                    {!isRecording && !isTranscribing && (
                        <button 
                            onClick={handleSend}
                            disabled={!inputText.trim() || processingStatus === 'processing'}
                            className={`p-2.5 rounded-full transition-all duration-200 ${
                                inputText.trim() && processingStatus !== 'processing'
                                ? 'bg-nl-text text-nl-bg hover:bg-white hover:scale-105' 
                                : 'bg-nl-surfaceHover text-nl-textDim cursor-not-allowed'
                            }`}
                        >
                            <ArrowRight size={20} />
                        </button>
                    )}
                 </div>
              </div>
              
              <div className="flex justify-center items-center mt-3 gap-4">
                 <p className="text-[10px] text-nl-textDim truncate">
                    AfroLearnAI can be inaccurate; please double-check responses.
                 </p>
                 <div className="hidden sm:flex text-[10px] text-nl-textDim items-center gap-1 bg-nl-surface px-2 py-0.5 rounded-full border border-nl-border">
                    <span>{hasInteraction ? `${Math.max(1, uploadedFiles.length)} sources` : '0 sources'}</span>
                 </div>
              </div>
           </div>
        </main>

        {/* Right Sidebar - Studio */}
        <aside className={`
            bg-nl-surface flex-col border-l md:border border-nl-border overflow-hidden
            xl:col-span-3 xl:flex xl:static xl:rounded-3xl xl:z-auto
            ${mobilePanel === 'studio' ? 'absolute inset-0 z-30 flex' : 'hidden'}
        `}>
           <div className="p-4 flex items-center justify-between border-b border-nl-border/50 shrink-0">
             <span className="font-medium text-nl-text">Studio</span>
             <div className="flex items-center gap-1">
               <button className="p-1 hover:bg-nl-surfaceHover rounded text-nl-textDim">
                 <MoreVertical size={16} />
               </button>
                <button onClick={() => setMobilePanel('none')} className="xl:hidden p-1 hover:bg-nl-surfaceHover rounded text-nl-textDim">
                 <X size={20} />
               </button>
             </div>
           </div>
           
           <div className="p-4 flex-1 overflow-y-auto">
             {hasInteraction ? (
                // Active Studio State
                <div className="space-y-4">
                    <div className="bg-nl-bg/50 border border-nl-border rounded-xl p-4">
                         <h4 className="text-xs font-bold text-nl-textDim uppercase tracking-wider mb-3">Generated Assets</h4>
                         <div className="space-y-2">
                             <StudioAssetItem icon={<FileText size={16}/>} title="Summary Note" type="Text" />
                             <StudioAssetItem icon={<AudioWaveform size={16}/>} title="Audio Overview" type="MP3 • 5m" />
                             <StudioAssetItem icon={<Network size={16}/>} title="Concept Map" type="Image" />
                             {infographicImage && <StudioAssetItem icon={<BarChart3 size={16}/>} title="Infographic" type="PNG" />}
                         </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <StudioCard icon={<Layers size={20}/>} label="Flashcards" />
                        <StudioCard icon={<BarChart3 size={20}/>} label="Infographic" />
                    </div>
                </div>
             ) : (
                // Empty Studio State
                <>
                <div className="grid grid-cols-2 gap-3">
                    <StudioCard icon={<AudioWaveform size={20}/>} label="Audio Overview" />
                    <StudioCard icon={<Network size={20}/>} label="Mind Map" />
                    <StudioCard icon={<Layers size={20}/>} label="Flashcards" />
                    <StudioCard icon={<BarChart3 size={20}/>} label="Infographic" />
                </div>

                <div className="mt-12 text-center px-6">
                    <div className="w-12 h-12 rounded-full bg-nl-bg border border-nl-border flex items-center justify-center mx-auto mb-4 text-brand-400">
                    <Zap size={24} />
                    </div>
                    <p className="text-sm text-nl-textDim mb-6">
                    Studio output will be saved here.
                    </p>
                    <button className="px-6 py-2 bg-nl-text text-nl-bg rounded-full font-semibold text-sm hover:bg-white transition-colors">
                    Add note
                    </button>
                </div>
                </>
             )}
           </div>
        </aside>

      </div>
    </div>
  );
};

// Helper Components for clean code

interface UploadOptionProps {
  icon: React.ReactNode;
  label: string;
  color?: string;
  onClick?: () => void;
}

const UploadOption: React.FC<UploadOptionProps> = ({ icon, label, color, onClick }) => (
  <button 
    onClick={onClick}
    className="flex items-center justify-center gap-2 p-3 rounded-xl border border-nl-border bg-nl-bg hover:bg-nl-surfaceHover hover:border-brand-500/50 transition-all group w-full"
  >
     <span className={`${color || 'text-nl-textDim'} group-hover:text-nl-text shrink-0`}>{icon}</span>
     <span className="text-xs md:text-sm font-medium text-nl-text group-hover:text-white truncate">{label}</span>
  </button>
);

interface StudioCardProps {
  icon: React.ReactNode;
  label: string;
}

const StudioCard: React.FC<StudioCardProps> = ({ icon, label }) => (
  <button className="flex flex-col items-start gap-2 p-3 md:p-4 rounded-2xl border border-nl-border bg-nl-bg/50 hover:bg-nl-surfaceHover hover:border-nl-textDim/50 transition-all text-left group h-20 md:h-24 w-full">
     <span className="text-nl-textDim group-hover:text-brand-400 transition-colors shrink-0">{icon}</span>
     <span className="text-xs font-medium text-nl-textDim group-hover:text-nl-text line-clamp-2">{label}</span>
  </button>
);

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon, label }) => (
    <button 
        onClick={onClick}
        className={`
            flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap
            ${active 
                ? 'bg-nl-surfaceHover text-brand-400 ring-1 ring-nl-border shadow-sm' 
                : 'text-nl-textDim hover:text-nl-text hover:bg-nl-surfaceHover/50'
            }
        `}
    >
        {icon}
        {label}
    </button>
);

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

const ActionButton: React.FC<ActionButtonProps> = ({ icon, label, onClick }) => (
    <button 
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-nl-border bg-nl-bg text-nl-textDim text-xs hover:text-nl-text hover:bg-nl-surfaceHover transition-colors"
    >
        {icon}
        <span>{label}</span>
    </button>
);

interface SourceItemProps {
  icon: React.ReactNode;
  title: string;
  source: string;
}

const SourceItem: React.FC<SourceItemProps> = ({ icon, title, source }) => (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-nl-bg border border-nl-border hover:border-nl-textDim/30 transition-colors cursor-pointer group">
        <div className="mt-0.5 text-nl-textDim group-hover:text-brand-400 transition-colors">{icon}</div>
        <div className="overflow-hidden">
            <h5 className="text-xs font-medium text-nl-text truncate mb-0.5">{title}</h5>
            <p className="text-[10px] text-nl-textDim truncate">{source}</p>
        </div>
    </div>
);

interface StudioAssetItemProps {
  icon: React.ReactNode;
  title: string;
  type: string;
}

const StudioAssetItem: React.FC<StudioAssetItemProps> = ({ icon, title, type }) => (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-nl-bg/50 border border-nl-border hover:bg-nl-surfaceHover transition-colors cursor-pointer">
        <div className="text-brand-400">{icon}</div>
        <div className="flex-1 overflow-hidden">
            <h5 className="text-xs font-medium text-nl-text truncate">{title}</h5>
            <p className="text-[10px] text-nl-textDim">{type}</p>
        </div>
    </div>
);