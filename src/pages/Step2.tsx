import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Check, Loader2, AlertCircle, Menu, RotateCcw, XCircle, RotateCw } from "lucide-react";
import Sidebar from '../components/Sidebar';
import { useAuth } from "../contexts/AuthContext";
import { showToast } from "../components/ui/toast";
import { callOpenAI, buildSelectionPrompt } from "../utils/aiHelpers";
import { supabase } from "../integrations/supabase/client";
import { extractTextFromBuffer } from "../utils/textExtraction";

const Step2: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = new URLSearchParams(location.search).get('mode');
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teleprompterText, setTeleprompterText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRecording, setHasRecording] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [teleprompterSpeed, setTeleprompterSpeed] = useState<number>(() => {
    const saved = localStorage.getItem("teleprompterSpeed");
    return saved ? parseFloat(saved) : 1;
  });

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  useEffect(() => {
    const checkRecording = async () => {
      const jobRequestId = localStorage.getItem("current_job_request_id");
      if (!jobRequestId || !user) return;
      const isCRM = localStorage.getItem("is_crm_user") === "true";
      try {
        if (isCRM) {
          const { data } = await supabase.from('crm_recordings').select('id').eq('job_request_id', jobRequestId).maybeSingle();
          if (data) setHasRecording(true);
        } else {
          const { data } = await supabase.from('recordings').select('id').eq('job_request_id', jobRequestId).maybeSingle();
          if (data) setHasRecording(true);
        }
      } catch (err) {
        console.error("Error checking recording status:", err);
      }
    };
    checkRecording();
  }, [user]);

  const generateIntroduction = async (rewrite = false) => {
    try {
      rewrite ? setIsRewriting(true) : setIsGenerating(true);
      setError(null);
      const resumeText = localStorage.getItem("resumeFullText");
      if (!resumeText) throw new Error("Resume text not found. Please upload your resume first.");
      const prompt = buildSelectionPrompt(resumeText);
      const result = await callOpenAI(prompt);
      setTeleprompterText(result);
      localStorage.setItem("teleprompterText", result);
      if (rewrite) showToast("Script regenerated!", "success");
    } catch (err: any) {
      setError(err.message || "Something went wrong while generating.");
    } finally {
      setIsGenerating(false);
      setIsRewriting(false);
    }
  };

  useEffect(() => {
    const initTeleprompter = async () => {
      const saved = localStorage.getItem("teleprompterText");
      const resumeText = localStorage.getItem("resumeFullText");
      const resumeUrl = localStorage.getItem("uploadedResumeUrl");

      if (saved) {
        setTeleprompterText(saved);
      } else if (resumeText) {
        generateIntroduction();
      } else if (resumeUrl) {
        // Handle case where we only have URL (e.g. proceeding from history)
        try {
          setIsGenerating(true);
          const response = await fetch(resumeUrl);
          if (!response.ok) throw new Error("Could not fetch resume file");
          const buffer = await response.arrayBuffer();
          const fileName = resumeUrl.split('/').pop() || "Resume.pdf";
          const extractedText = await extractTextFromBuffer(buffer, fileName);
          localStorage.setItem("resumeFullText", extractedText);
          
          // Now generate with the extracted text
          const prompt = buildSelectionPrompt(extractedText);
          const result = await callOpenAI(prompt);
          setTeleprompterText(result);
          localStorage.setItem("teleprompterText", result);
        } catch (err: any) {
          console.error("Extraction failed:", err);
          setError("Failed to extract text from resume. Please try re-uploading.");
        } finally {
          setIsGenerating(false);
        }
      } else {
        setError("Please upload your resume first.");
      }
    };
    
    initTeleprompter();
  }, []);

  const handleStartRecording = () => {
    if (!teleprompterText) {
      showToast("Wait for AI to generate your script first.", "warning");
      return;
    }
    localStorage.setItem("teleprompterText", teleprompterText);
    localStorage.setItem("teleprompterSpeed", teleprompterSpeed.toString());
    navigate(`/record${mode ? `?mode=${mode}` : ''}`);
  };

  const handleFinishAndSave = () => {
    if (!hasRecording) {
      setShowExitModal(true);
    } else {
      showToast("Digital Resume progress saved!", "success");
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-white flex relative">
      {/* Custom Exit Modal */}
      {showExitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Wait a moment!</h3>
            <p className="text-gray-600 mb-6">You <strong className="text-red-600">haven't recorded</strong> your video yet. Do you really want to exit without finishing your <strong>video</strong> for <strong>Digital Resume?</strong></p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowExitModal(false)}>No, Stay</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={() => navigate("/dashboard")}>Yes, Exit</Button>
            </div>
          </div>
        </div>
      )}

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}></div>
      )}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-auto transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out`}>
        <Sidebar userEmail={user?.email || ''} onLogout={handleLogout} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none">
            <Menu className="h-6 w-6" />
          </button>
          <div className="font-bold text-xl text-[#0B4F6C]">careercast</div>
          <div className="w-10"></div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-gray-50">
          <div className="max-w-4xl mx-auto">
            <Card className="w-full">
              <CardHeader>
                <div className="flex justify-center items-center mb-10 relative gap-x-20 sm:gap-x-32 max-w-4xl mx-auto">
                  <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-300 -z-10 w-[60%] sm:w-[40%] mx-auto"></div>
                  <div className="flex flex-col items-center relative z-10">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
                      <Check className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] sm:text-xs mt-1.5 text-emerald-600 font-bold hidden min-[450px]:block">Upload Resume</span>
                    <span className="text-[10px] sm:text-xs mt-1.5 text-emerald-600 font-bold min-[450px]:hidden text-center leading-tight">Resume</span>
                  </div>
                  <div className="flex flex-col items-center relative z-10">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-lg shadow-blue-200">2</div>
                    <span className="text-[10px] sm:text-xs mt-1.5 text-blue-600 font-bold hidden min-[450px]:block">Record Video</span>
                    <span className="text-[10px] sm:text-xs mt-1.5 text-blue-600 font-bold min-[450px]:hidden text-center leading-tight">Video</span>
                  </div>
                </div>
                <CardTitle className="text-xl sm:text-2xl font-bold text-center">Record Your Digital Resume Video</CardTitle>
              </CardHeader>

              <CardContent>
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
                    <AlertCircle className="h-5 w-5 text-red-500 mr-2 mt-0.5" />
                    <div className="text-red-700 text-sm">{error}</div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold mb-3 flex items-center">🎥 Video Recording</h3>
                    <div className="bg-gray-100 rounded-lg p-4 text-center mb-4 border border-gray-200">
                      {hasRecording ? (
                        <div className="bg-green-100 rounded-lg h-32 sm:h-48 flex flex-col items-center justify-center mb-4 text-green-700">
                          <Check className="h-10 w-10 mb-2" />
                          <p className="font-medium">Video Recorded!</p>
                        </div>
                      ) : (
                        <div className="bg-gray-300 rounded-lg h-32 sm:h-48 flex items-center justify-center mb-4 text-gray-600">Camera Preview</div>
                      )}
                      <Button onClick={handleStartRecording} className="w-full" disabled={isGenerating || !teleprompterText}>
                        {hasRecording ? "Re-record Video" : "Start Recording"}
                      </Button>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base sm:text-lg font-semibold flex items-center">
                        📜 Teleprompter
                        {/* {(isGenerating || isRewriting) && <Loader2 className="h-4 w-4 ml-2 animate-spin text-blue-600" />} */}
                      </h3>
                      <button
                        onClick={() => generateIntroduction(true)}
                        disabled={isRewriting || isGenerating}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
                        title="Regenerate Script"
                      >
                        <span className="flex items-center gap-2 pr-4">  <RotateCw className={`w-5 h-5 ${isRewriting ? 'animate-spin' : ''}`} /><span>Regenerate script</span></span>
                      </button>
                    </div>

                    <div className="bg-gray-900 text-white rounded-lg p-3 h-48 sm:h-64 overflow-y-auto mb-4 font-mono text-xs sm:text-sm shadow-inner">
                      {isGenerating || isRewriting ? (
                        <div className="flex items-center justify-center h-full text-center">
                          <div><Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-white" /><p className="text-sm">Preparing script...</p></div>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap leading-relaxed">{teleprompterText}</div>
                      )}
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium text-gray-700 font-semibold">Speed: {teleprompterSpeed.toFixed(1)}x</label>
                      </div>
                      <input type="range" min="0.5" max="2" step="0.1" value={teleprompterSpeed} onChange={(e) => setTeleprompterSpeed(parseFloat(e.target.value))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-6 border-t border-gray-100">
                  <Button variant="outline" onClick={() => navigate(`/step1${mode ? `?mode=${mode}` : ''}`)} disabled={isGenerating} className="px-8">Back</Button>
                  <Button
                    onClick={handleFinishAndSave}
                    disabled={isGenerating || !teleprompterText}
                    className="px-8 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Finish & Save
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Step2;
