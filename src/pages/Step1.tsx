import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Check, Menu, Loader2, Play, FileText, ChevronRight, History, User, ExternalLink, X, Clock } from "lucide-react";
import { supabase } from "../integrations/supabase/client";
import { useAuth } from "../contexts/AuthContext";
import { callOpenAI, buildSelectionPrompt } from "../utils/aiHelpers";
import { extractTextFromBuffer } from "../utils/textExtraction";
import Sidebar from "../components/Sidebar";
import { showToast } from "../components/ui/toast";
import { getUserInfo } from "../utils/crmHelpers";
import { viewDocumentSafe } from "../utils/documentUtils";



const Step1: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const searchParams = new URLSearchParams(location.search);
  const mode = searchParams.get('mode');
  const showHistory = mode === 'continue';

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [apiResumeUrl, setApiResumeUrl] = useState<string | null>(null);
  const [isCheckingApi, setIsCheckingApi] = useState(false);

  // History State
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

  // Check for API resume & Fetch History on mount
  useEffect(() => {
    const initData = async () => {
      const email = localStorage.getItem("crm_user_email") || user?.email;
      if (!email) return;

      setIsCheckingApi(true);
      setLoadingHistory(true);
      try {
        // 1. Check API Resume
        const response = await fetch(`/api/proxy-applywizz?email=${email.trim().toLowerCase()}`);
        if (response.ok) {
          const jsonResponse = await response.json();
          const userData = Array.isArray(jsonResponse) ? jsonResponse[0] : jsonResponse;
          const vResumeUrl = userData?.data?.resume?.pdf_path?.[0] || userData?.resume?.pdf_path?.[0];
          if (vResumeUrl) {
            setApiResumeUrl(vResumeUrl);
          }
        }

        // 2. Fetch History
        const isCRM = localStorage.getItem("is_crm_user") === "true";
        if (isCRM) {
          const { data: crmJobs, error } = await supabase
            .from('crm_job_requests')
            .select('id, job_title, resume_url, job_description, application_status, created_at, email')
            .eq('email', email.trim().toLowerCase())
            .order('created_at', { ascending: false });

          if (!error && crmJobs) {
            const jobsWithRecs = await Promise.all(crmJobs.map(async (job) => {
              const { data: recs } = await supabase
                .from('crm_recordings')
                .select('video_url')
                .eq('job_request_id', job.id)
                .limit(1);
              return { ...job, video_url: recs?.[0]?.video_url };
            }));
            setHistory(jobsWithRecs);
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setIsCheckingApi(false);
        setLoadingHistory(false);
      }
    };
    initData();
  }, [user]);

  const handleFileSelect = (file: File) => {
    const validTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    const fileExt = file.name.split(".").pop()?.toLowerCase();
    if (!validTypes.includes(file.type) && !["pdf", "doc", "docx"].includes(fileExt || "")) {
      showToast("Please upload a PDF or DOCX file.", "warning");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast("File size exceeds 10MB limit.", "warning");
      return;
    }
    setSelectedFile(file);
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showToast("Please sign in again.", "warning");
      return;
    }

    setIsUploading(true);
    try {
      const jobRequestId = localStorage.getItem("current_job_request_id");
      const existingResumeUrl = localStorage.getItem("uploadedResumeUrl");
      const existingResumeText = localStorage.getItem("resumeFullText");

      let activeJobRequestId = jobRequestId;

      if (!activeJobRequestId) {
        const userInfo = await getUserInfo(user.id);
        const isCRMUser = userInfo.isCRMUser && userInfo.email;
        const jobTitle = "New Digital Resume";
        const jobDescription = "Generated from resume analysis";

        if (isCRMUser) {
          const { data, error } = await supabase.from('crm_job_requests').insert([{
            email: userInfo.email, user_id: user.id, job_title: jobTitle, job_description: jobDescription, application_status: 'draft',
          }]).select('id').single();
          if (error) throw error;
          activeJobRequestId = data.id;
          localStorage.setItem('current_job_request_id', data.id);
          localStorage.setItem('is_crm_user', 'true');
          localStorage.setItem('crm_user_email', userInfo.email || '');
        } else {
          const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
          if (!profile) {
            await supabase.from('profiles').insert([{ id: user.id, email: user.email, plan_tier: 'free', plan_status: 'active', credits_remaining: 3 }]);
          }
          const { data, error } = await supabase.from('job_requests').insert([{
            user_id: user.id, email: user.email, job_title: jobTitle, job_description: jobDescription, status: 'draft',
          }]).select('id').single();
          if (error) throw error;
          activeJobRequestId = data.id;
          localStorage.setItem('current_job_request_id', data.id);
          localStorage.setItem('is_crm_user', 'false');
        }
      }

      let finalResumeUrl = existingResumeUrl;
      let finalResumeText = existingResumeText;
      let finalFileName = localStorage.getItem("resumeFileName") || "Resume.pdf";

      if (selectedFile) {
        const fileExt = selectedFile.name.split(".").pop()?.toLowerCase();
        const firstName = localStorage.getItem("first_name") || (user as any)?.user_metadata?.full_name?.split(" ")[0] || "user";
        const fileName = `${firstName.toLowerCase()}_careercast_${Date.now()}.${fileExt}`;
        const isCRM = localStorage.getItem("is_crm_user") === "true";
        const bucket = isCRM ? "CRM_users_resumes" : "resumes";
        const path = isCRM ? `${localStorage.getItem("crm_user_email")}/${fileName}` : `${user.id}/${fileName}`;

        const { error: upErr } = await supabase.storage.from(bucket).upload(path, selectedFile, { upsert: true, contentType: selectedFile.type });
        if (upErr) throw upErr;

        const { data: pubData } = supabase.storage.from(bucket).getPublicUrl(path);
        finalResumeUrl = pubData.publicUrl;
        finalFileName = selectedFile.name;

        const buffer = await selectedFile.arrayBuffer();
        finalResumeText = await extractTextFromBuffer(buffer, selectedFile.name);

        if (isCRM) {
          await supabase.from("crm_job_requests").update({ resume_url: finalResumeUrl, application_status: "ready" }).eq("id", activeJobRequestId);
        } else {
          await supabase.from("job_requests").update({ resume_path: finalResumeUrl, status: "ready" }).eq("id", activeJobRequestId);
        }
      } else if (apiResumeUrl) {
        const proxyUrl = `/api/proxy-pdf?url=${encodeURIComponent(apiResumeUrl)}`;
        const res = await fetch(proxyUrl);
        const buffer = await res.arrayBuffer();
        finalResumeText = await extractTextFromBuffer(buffer, apiResumeUrl.split('?')[0]);
        finalResumeUrl = apiResumeUrl;
        finalFileName = apiResumeUrl.split('/').pop()?.split('?')[0] || "Profile_Resume.pdf";
      } else if (existingResumeUrl && !finalResumeText) {
        const isExternal = existingResumeUrl.startsWith('http') && !existingResumeUrl.includes(window.location.host);
        const fetchUrl = isExternal ? `/api/proxy-pdf?url=${encodeURIComponent(existingResumeUrl)}` : existingResumeUrl;
        const res = await fetch(fetchUrl);
        const buffer = await res.arrayBuffer();
        finalResumeText = await extractTextFromBuffer(buffer, existingResumeUrl.split('?')[0]);
      }

      if (!finalResumeText && !selectedFile && !apiResumeUrl && !existingResumeUrl) {
        showToast("Please select a resume file.", "warning");
        return;
      }

      // 3. Automatically send to AI to generate script
      if (finalResumeText) {
        try {
          const aiPrompt = buildSelectionPrompt(finalResumeText);
          const aiScript = await callOpenAI(aiPrompt);
          localStorage.setItem("teleprompterText", aiScript);

          // Save to database immediately
          if (activeJobRequestId) {
            const isCRM = localStorage.getItem("is_crm_user") === "true";
            if (isCRM) {
              await supabase.from("crm_job_requests").update({ job_description: aiScript }).eq("id", activeJobRequestId);
            } else {
              await supabase.from("job_requests").update({ job_description: aiScript }).eq("id", activeJobRequestId);
            }
          }
        } catch (aiErr) {
          console.error("❌ AI generation failed in Step 1:", aiErr);
          localStorage.removeItem("teleprompterText");
          // Don't block the user, Step 2 or 3 will try again
        }
      }

      // 4. Finalize
      localStorage.setItem("uploadedResumeUrl", finalResumeUrl || "");
      localStorage.setItem("resumeFileName", finalFileName);
      localStorage.setItem("resumeFullText", finalResumeText || "");

      showToast("Resume processed and script generated!", "success");
      navigate(`/step2${mode ? `?mode=${mode}` : ''}`);
    } catch (err: any) {
      console.error("❌ Process failed:", err);
      showToast("Failed to process resume: " + err.message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleProceed = (item: any) => {
    localStorage.removeItem("teleprompterText");
    localStorage.removeItem("resumeFullText");
    localStorage.setItem("current_job_request_id", item.id);
    localStorage.setItem("uploadedResumeUrl", item.resume_url || "");
    localStorage.setItem("careercast_jobDescription", item.job_description || "");
    localStorage.setItem("resumeFileName", item.resume_url ? item.resume_url.split('/').pop() : "Resume.pdf");

    // Maintain CRM status if we're in continue mode
    if (localStorage.getItem('is_crm_user') !== 'true' && item.email) {
      localStorage.setItem('is_crm_user', 'true');
      localStorage.setItem('crm_user_email', item.email);
    }

    navigate(`/step2${mode ? `?mode=${mode}` : ""}`);
  };

  return (
    <div className="min-h-screen bg-white flex">
      {sidebarOpen && <div className="fixed inset-0 bg-black opacity-50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}></div>}
      <div className={`fixed lg:static inset-y-0 left-0 z-50 w-auto transform ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 transition-transform duration-300 ease-in-out`}>
        <Sidebar userEmail={user?.email || ""} onLogout={handleLogout} />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-700 hover:bg-gray-100 rounded-md"><Menu className="h-6 w-6" /></button>
          <div className="font-normal text-xl text-[#0B4F6C]">careercast</div>
          <div className="w-10"></div>
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-gray-50">
          <div className={`mx-auto flex flex-col lg:flex-row gap-8 ${showHistory ? 'max-w-7xl' : 'max-w-2xl'}`}>
            {/* Left Column: Upload Card */}
            <div className={showHistory ? 'lg:w-[70%]' : 'w-full'}>
              <Card className="w-full">
                <CardHeader>
                  <div className="flex justify-center items-center mb-10 relative gap-x-20 sm:gap-x-32 max-w-4xl mx-auto">
                    <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-300 -z-10 w-[60%] sm:w-[40%] mx-auto"></div>
                    <div className="flex flex-col items-center relative z-10">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-normal shadow-lg shadow-blue-200">
                        1
                      </div>
                      <span className="text-[10px] sm:text-xs mt-1.5 text-blue-600 font-normal hidden min-[450px]:block">Upload Resume</span>
                      <span className="text-[10px] sm:text-xs mt-1.5 text-blue-600 font-normal min-[450px]:hidden text-center leading-tight">Resume</span>
                    </div>
                    <div className="flex flex-col items-center relative z-10">
                      <div className="w-8 h-8 rounded-full bg-gray-300 text-gray-600 flex items-center justify-center text-sm font-normal">2</div>
                      <span className="text-[10px] sm:text-xs mt-1.5 text-gray-400 font-normal hidden min-[450px]:block">Record Video</span>
                      <span className="text-[10px] sm:text-xs mt-1.5 text-gray-400 font-normal min-[450px]:hidden text-center leading-tight">Video</span>
                    </div>
                  </div>
                  <CardTitle className="text-xl font-normal text-center">Upload Your Resume</CardTitle>
                </CardHeader>
                <CardContent>
                  {(apiResumeUrl || localStorage.getItem("uploadedResumeUrl")) && (
                    <div
                      onClick={() => {
                        const url = localStorage.getItem("uploadedResumeUrl") || apiResumeUrl;
                        if (url) viewDocumentSafe(url);
                      }}
                      className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-emerald-100 transition-all group"
                      title="Click to view current resume in new tab"
                    >
                      <div className="bg-white p-2 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                        <Check className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-normal text-emerald-900 leading-tight">{localStorage.getItem("uploadedResumeUrl") ? "Resume already uploaded" : "Resume found from profile"}</p>
                        <p className="text-xs text-emerald-700/70 mt-0.5 font-medium">{localStorage.getItem("resumeFileName") || "Ready to proceed."}</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-emerald-400 group-hover:text-emerald-600 transition-colors" />
                    </div>
                  )}
                  <form onSubmit={handleSubmit}>
                    <div className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400"} ${selectedFile ? "bg-green-50 border-green-200" : "min-h-[150px] flex items-center justify-center"}`}
                      onClick={() => fileInputRef.current?.click()} onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFileSelect(e.dataTransfer.files[0]); }}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)}>
                      {!selectedFile ? (
                        <div>
                          <div className="text-3xl mb-3">📄</div>
                          <p className="text-base font-medium text-gray-700 mb-1">Your resume is already uploaded, if you want to replace your resume</p>
                          <p className="text-base font-medium text-gray-700 mb-1">Click to upload or drag and drop</p>
                          <p className="text-xs text-gray-500">PDF or DOCX (max 10MB)</p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center space-x-2 text-green-700"><Check className="h-5 w-5" /><span className="font-medium">Resume Selected Successfully</span></div>
                      )}
                      <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])} />
                    </div>
                    {selectedFile && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-4 flex items-center justify-between">
                        <div className="flex items-center space-x-3"><div className="text-green-600 font-normal text-xl">📄</div><div><p className="font-medium text-gray-900 text-sm">{selectedFile.name}</p></div></div>
                        <button type="button" className="text-gray-400 hover:text-gray-600 font-normal" onClick={removeFile}>✕</button>
                      </div>
                    )}
                    <div className="flex justify-between pt-6">
                      <Button type="button" variant="outline" onClick={() => navigate("/dashboard")} disabled={isUploading}>Back</Button>
                      <Button type="submit" disabled={isUploading} className="min-w-[120px]">{isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</> : "Next Step →"}</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Right Column: History Panel (30%) — only shown when continuing */}
            {showHistory && (
              <div className="lg:w-[30%]">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-8">
                  <div className="bg-gradient-to-r from-[#0B4F6C] to-[#159A9C] p-4 flex items-center gap-2">
                    <History className="w-5 h-5 text-white" />
                    <h3 className="text-white font-normal">Previous History</h3>
                  </div>

                  <div className="p-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                    {loadingHistory ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-[#0B4F6C]" />
                        <p className="text-sm text-gray-400 italic">loading history...</p>
                      </div>
                    ) : history.length > 0 ? (
                      <div className="space-y-4">
                        {history.map((item, idx) => (
                          <div key={item.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-3">
                              <div className="min-w-0">
                                <h4 className="font-normal text-[#0B4F6C] text-sm truncate">Recording-{history.length - idx}</h4>
                                <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(item.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="bg-white px-2 py-0.5 rounded text-[9px] font-normal text-gray-400 border border-gray-100">
                                S.No {history.length - idx}
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <button
                                onClick={() => item.resume_url && viewDocumentSafe(item.resume_url)}
                                disabled={!item.resume_url}
                                className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white border border-gray-100 hover:border-blue-200 hover:text-blue-600 transition-colors text-gray-500 disabled:opacity-30"
                                title="View Resume"
                              >
                                <FileText className="w-4 h-4" />
                                <span className="text-[9px] font-normal uppercase">Resume</span>
                              </button>

                              <button
                                onClick={() => item.video_url && setSelectedVideo(item.video_url)}
                                disabled={!item.video_url}
                                className="flex flex-col items-center gap-1 p-2 rounded-lg bg-white border border-gray-100 hover:border-emerald-200 hover:text-emerald-600 transition-colors text-gray-500 disabled:opacity-30"
                                title="Play Video"
                              >
                                <Play className="w-4 h-4" />
                                <span className="text-[9px] font-normal uppercase">Play</span>
                              </button>

                              <button
                                onClick={() => handleProceed(item)}
                                className="flex flex-col items-center gap-1 p-2 rounded-lg bg-[#0B4F6C] text-white hover:bg-[#159A9C] transition-all group/btn"
                                title="Proceed to Step 2"
                              >
                                <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                                <span className="text-[9px] font-normal uppercase">Proceed</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-10 px-4">
                        <div className="bg-gray-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                          <User className="w-6 h-6 text-gray-300" />
                        </div>
                        <p className="text-sm font-normal text-gray-400">No previous history found</p>
                        <p className="text-[10px] text-gray-400 mt-1">your recorded profiles will appear here</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Video Player Modal */}
        {selectedVideo && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="bg-gradient-to-r from-[#0B4F6C] to-[#159A9C] p-4 flex justify-between items-center">
                <h3 className="text-white font-black text-lg flex items-center gap-2">
                  <Play className="w-5 h-5" fill="white" />
                  Video Preview
                </h3>
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 bg-gray-50">
                <div className="bg-black rounded-xl overflow-hidden shadow-inner">
                  <video
                    controls
                    autoPlay
                    className="w-full h-auto"
                    style={{ maxHeight: '70vh' }}
                    src={selectedVideo}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Step1;
