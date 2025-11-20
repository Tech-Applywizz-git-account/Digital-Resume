import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { BookOpen, Video, FileText, Lightbulb, TrendingUp, Award, X, Menu, ExternalLink } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Resources() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<number | null>(null);

  const handleLogout = () => {
    navigate('/');
  };

  const handleCloseModal = () => {
    setSelectedResource(null);
  };

  const resources = [
    {
      icon: Video,
      title: 'Video Resume Best Practices',
      description: 'Learn how to create compelling video resumes that stand out to employers',
      color: 'from-blue-500 to-blue-600',
      link: 'https://example.com/video-resume-best-practices',
      detailedContent: `
        <h3 class="text-xl font-bold text-gray-900 mb-4">Video Resume Best Practices</h3>
        <p class="text-gray-600 mb-4">Creating an effective video resume requires more than just recording yourself talking. Here are key strategies to make your video resume stand out:</p>
        
        <h4 class="font-bold text-gray-900 mb-2">1. Preparation is Key</h4>
        <ul class="list-disc list-inside text-gray-600 mb-4">
          <li>Research the company and role thoroughly</li>
          <li>Prepare a clear, concise script (60-90 seconds)</li>
          <li>Practice your delivery multiple times</li>
          <li>Prepare for potential follow-up questions</li>
        </ul>
        
        <h4 class="font-bold text-gray-900 mb-2">2. Technical Setup</h4>
        <ul class="list-disc list-inside text-gray-600 mb-4">
          <li>Use good lighting (natural light works best)</li>
          <li>Ensure clear audio quality</li>
          <li>Choose a clean, professional background</li>
          <li>Test your equipment before recording</li>
        </ul>
        
        <h4 class="font-bold text-gray-900 mb-2">3. Content Structure</h4>
        <ul class="list-disc list-inside text-gray-600 mb-4">
          <li>Start with a strong introduction</li>
          <li>Highlight 2-3 key achievements</li>
          <li>Show enthusiasm for the role/company</li>
          <li>End with a clear call-to-action</li>
        </ul>
        
        <h4 class="font-bold text-gray-900 mb-2">4. Presentation Tips</h4>
        <ul class="list-disc list-inside text-gray-600 mb-4">
          <li>Maintain good eye contact with the camera</li>
          <li>Speak clearly and at a moderate pace</li>
          <li>Use natural gestures to emphasize points</li>
          <li>Dress professionally (business casual or formal)</li>
        </ul>
      `
    },
    {
      icon: FileText,
      title: 'Resume Templates',
      description: 'Download professional resume templates tailored for various industries',
      color: 'from-green-500 to-green-600',
      link: 'https://example.com/resume-templates',
      detailedContent: `
        <h3 class="text-xl font-bold text-gray-900 mb-4">✅ Resume Templates</h3>
        <p class="text-gray-600 mb-4">
          Our templates highlight your skills, achievements, and experience with clear structure, measurable bullet points, and global hiring standards. Built for clarity, impact, and ATS compatibility across all industries.
        </p>
        
        <h4 class="font-bold text-gray-900 mb-2">⭐ Template Features</h4>
        <p class="text-gray-600 mb-2">Professional header (Name, Title, Location, Contact, LinkedIn)</p>
        <p class="text-gray-600 mb-2">Sharp 2–4 line summary</p>
        <p class="text-gray-600 mb-2">Defined Areas of Expertise / Core Skills</p>
        <p class="text-gray-600 mb-2">Action-driven bullet points (Action Verb + Task + Metric)</p>
        <p class="text-gray-600 mb-4">Sections include: Professional Experience, Education, Skills, Projects (for students), Certifications & Courses, Achievements & Languages</p>
        
        <p class="text-gray-600 mb-2">Additional benefits:</p>
        <ul class="list-disc pl-5 space-y-1 text-gray-600 mb-4">
          <li>Clean, ATS-safe formatting</li>
          <li>Layouts for graduates, experienced roles, promotions & specialist profiles</li>
        </ul>
        
        <h4 class="font-bold text-gray-900 mb-2">💼 Popular Industries</h4>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          <div class="text-gray-600">IT & Software</div>
          <div class="text-gray-600">Data & Analytics</div>
          <div class="text-gray-600">Sales & Marketing</div>
          <div class="text-gray-600">Finance & Accounting</div>
          <div class="text-gray-600">HR & Operations</div>
          <div class="text-gray-600">Customer Support</div>
          <div class="text-gray-600">Project & Product Management</div>
          <div class="text-gray-600">Engineering & Manufacturing</div>
          <div class="text-gray-600">Retail & Hospitality</div>
          <div class="text-gray-600">Consulting</div>
          <div class="text-gray-600">Digital Marketing & Automation</div>
          <div class="text-gray-600">All Graduate Fields</div>
        </div>
        
        <h4 class="font-bold text-gray-900 mb-2">📝 Customization Tips</h4>
        <ol class="list-decimal pl-5 space-y-3 text-gray-600 mb-4">
          <li>
            <strong>Strong Summary:</strong><br/>
            2–4 lines about who you are, what you offer, and key achievements.
          </li>
          <li>
            <strong>Tailor Skills:</strong><br/>
            Add 6–10 relevant hard + soft skills.
          </li>
          <li>
            <strong>Power Bullet Points:</strong><br/>
            Use strong verbs + clear tasks + measurable results.
          </li>
          <li>
            <strong>Add Projects (Graduates):</strong><br/>
            Show tools used, problem solved, and outcomes.
          </li>
          <li>
            <strong>Keep It Clean:</strong><br/>
            Avoid long paragraphs, icons, or fancy designs.
          </li>
          <li>
            <strong>Add Certifications:</strong><br/>
            Include recent, job-relevant courses.
          </li>
          <li>
            <strong>Highlight Education:</strong><br/>
            Mention degree, year, modules, and achievements.
          </li>
        </ol>
        
        <div class="mt-6">
          <h4 class="font-bold text-gray-900 mb-2">Free Resources:</h4>
          <ul class="list-disc pl-5 space-y-2 text-gray-600">
            <li><a href="https://docs.google.com/document/d/e/2PACX-1vSQOVUQcmxoJoj7wjhC4sjzrbEMzctS9HvxVae4unMqAvlD-pa0lkIxQUVUpO97yIcvI7YVRPq1zVOv/pub" target="_blank" rel="noopener noreferrer" class="text-[#01796F] hover:underline">Resume Templates</a></li>
          </ul>
        </div>
      `
    },
    {
      icon: Lightbulb,
      title: 'Interview Tips',
      description: 'Master the art of interviewing with our comprehensive guide',
      color: 'from-yellow-500 to-yellow-600',
      link: 'https://example.com/interview-tips',
      detailedContent: `
        <h3 class="text-xl font-bold text-gray-900 mb-4">HOW TO ACE YOUR NEXT INTERVIEW</h3>
        <ol class="list-decimal pl-5 space-y-3 text-gray-600">
          <li>
            <strong>Research the Company Thoroughly</strong><br/>
            Learn about their mission, values, culture, products, leadership team, and recent news.<br/><br/>
            This helps you give sharper answers and show genuine interest.
          </li>
          <li>
            <strong>Study the Job Description in Detail</strong><br/>
            Note the required skills, responsibilities, and keywords.<br/><br/>
            Match your experience to what they're looking for and prepare examples.
          </li>
          <li>
            <strong>Practice Answers to Common Interview Questions</strong><br/>
            Questions like "Tell me about yourself," "Strengths/weaknesses," and "Why should we hire you?" always come up.<br/><br/>
            Practice short, confident, job-focused answers.
          </li>
          <li>
            <strong>Use the STAR Method for Behavioural Questions</strong><br/>
            Explain your experience using:<br/>
            S – Situation<br/>
            T – Task<br/>
            A – Action<br/>
            R – Result<br/><br/>
            This helps you give structured, impressive answers.
          </li>
          <li>
            <strong>Dress Professionally</strong><br/>
            Wear formal or business casual based on the company's dress code.<br/><br/>
            Clean, neat, and professional always works.
          </li>
          <li>
            <strong>Prepare Your Own Questions in Advance</strong><br/>
            Questions about growth, team structure, expectations, and culture show that you're serious about the role.
          </li>
          <li>
            <strong>Carry All Essential Documents</strong><br/>
            Copies of your resume, certificates, ID, work samples, and a notebook/pen.<br/><br/>
            Being prepared makes you look organised.
          </li>
          <li>
            <strong>Follow Up After the Interview</strong><br/>
            Send a thank-you email within 24 hours, appreciating their time and reaffirming your interest in the role.<br/><br/>
            If there's no update within a week after the job closing date, send one more polite follow-up.
          </li>
        </ol>
        <div class="mt-6">
          <h4 class="font-bold text-gray-900 mb-2">Free Resources:</h4>
          <ul class="list-disc pl-5 space-y-2 text-gray-600">
            <li><a href="https://how-to-ace-your-next-int-o8c6xx4.gamma.site/" target="_blank" rel="noopener noreferrer" class="text-[#01796F] hover:underline">How to Ace Your Next Interview Guide</a></li>
            <li><a href="https://how-to-end-an-interview--v86rwn5.gamma.site/" target="_blank" rel="noopener noreferrer" class="text-[#01796F] hover:underline">How to End an Interview Successfully</a></li>
          </ul>
        </div>
      `
    },
    {
      icon: TrendingUp,
      title: 'Career Development',
      description: 'Strategies for advancing your career and achieving professional goals',
      color: 'from-purple-500 to-purple-600',
      link: 'https://example.com/career-development',
      detailedContent: `
        <h3 class="text-xl font-bold text-gray-900 mb-4">Career Advancement Strategies</h3>
        <p class="text-gray-600 mb-4">Take control of your professional growth with these proven development techniques:</p>
        
        <h4 class="font-bold text-gray-900 mb-2">Setting Career Goals</h4>
        <ul class="list-disc list-inside text-gray-600 mb-4">
          <li>Define short-term and long-term objectives</li>
          <li>Align goals with your values and interests</li>
          <li>Create measurable, time-bound milestones</li>
          <li>Regularly review and adjust your goals</li>
        </ul>
        
        <h4 class="font-bold text-gray-900 mb-2">Skills Development</h4>
        <ul class="list-disc list-inside text-gray-600 mb-4">
          <li>Identify in-demand skills in your industry</li>
          <li>Pursue relevant certifications and courses</li>
          <li>Seek mentorship and coaching opportunities</li>
          <li>Practice new skills in real-world projects</li>
        </ul>
        
        <h4 class="font-bold text-gray-900 mb-2">Networking and Relationships</h4>
        <ul class="list-disc list-inside text-gray-600 mb-4">
          <li>Build genuine professional relationships</li>
          <li>Attend industry events and conferences</li>
          <li>Engage on professional social platforms</li>
          <li>Offer value to your network connections</li>
        </ul>
        
        <h4 class="font-bold text-gray-900 mb-2">Performance and Visibility</h4>
        <ul class="list-disc list-inside text-gray-600 mb-4">
          <li>Exceed expectations in your current role</li>
          <li>Document and communicate your achievements</li>
          <li>Volunteer for high-visibility projects</li>
          <li>Seek feedback and act on it constructively</li>
        </ul>
      `
    },
    {
      icon: Award,
      title: 'Skill Building',
      description: 'Courses and certifications to enhance your professional skillset',
      color: 'from-red-500 to-red-600',
      link: 'https://example.com/skill-building',
      detailedContent: `
        <h3 class="text-xl font-bold text-gray-900 mb-4">SKILL BUILDING – LEVEL UP YOUR CAREER</h3>
        <p class="text-gray-600 mb-4">Upskilling is no longer optional — it's what makes you stand out.</p>
        <p class="text-gray-600 mb-4">Whether you're applying abroad or switching careers, learning the right skills can boost your confidence, improve your resume, and increase your chances of getting interview calls.</p>
        <p class="text-gray-600 mb-4">Here's how to build strong, job-ready skills using top free courses and certifications:</p>
        
        <ol class="list-decimal pl-5 space-y-4 text-gray-600">
          <li>
            <strong>Start With Essential Tech Skills</strong><br/>
            Even if you're from a non-tech background, knowing the basics of Python, SQL, or Java makes you more employable.<br/><br/>
            Free certified courses are available from Microsoft, IBM, Infosys, Cisco, and AWS.<br/>
            Great starting points:<br/>
            Python for Beginners – Microsoft<br/>
            SQL for Data Science – IBM SkillsBuild<br/>
            Java Programming – Infosys Springboard<br/>
            These certifications add real value to your resume.
          </li>
          <li>
            <strong>Strengthen Your Data & Analytics Knowledge</strong><br/>
            Data is used in every industry today — marketing, finance, HR, operations, software… everything.<br/><br/>
            Learning analytics helps you take better decisions and impress interviewers.<br/>
            Recommended courses:<br/>
            Introduction to Data Science – Cisco<br/>
            Get Started with Microsoft Data Analytics – Microsoft<br/>
            Data Science Foundations – IBM<br/>
            These are beginner-friendly and industry-recognized.
          </li>
          <li>
            <strong>Learn Artificial Intelligence & Machine Learning Basics</strong><br/>
            AI isn't the future — it's happening right now.<br/><br/>
            Understanding AI & ML fundamentals gives you an advantage, regardless of your role.<br/>
            Top free courses:<br/>
            AI Fundamentals – Microsoft<br/>
            Fundamentals of Machine Learning – NVIDIA<br/>
            AI Essentials – LinkedIn + Microsoft Learning Path<br/>
            These help you speak confidently during interviews and understand modern workplace tools.
          </li>
          <li>
            <strong>Master Generative AI — The Skill Every Recruiter Looks For</strong><br/>
            Generative AI skills are in high demand across marketing, content, coding, design, customer service, and operations.<br/>
            Useful free programs:<br/>
            Introduction to Generative AI – Google Cloud Skills Boost<br/>
            Career Essentials in Generative AI – Microsoft + LinkedIn<br/>
            NVIDIA Generative AI Training<br/>
            Learning GenAI boosts productivity and shows employers you can work smart.
          </li>
          <li>
            <strong>Build Practical AI Skills (Prompt Engineering, RAG, Agents, Fine-Tuning)</strong><br/>
            Microsoft recently launched 18 high-quality free AI courses — better than most paid programs.<br/><br/>
            If you want to stand out, learn prompt engineering, text generation apps, AI agents, and RAG (Retrieval Augmented Generation).<br/>
            Must-learn topics:<br/>
            Intro to Generative AI<br/>
            Prompt Engineering + Advanced Prompts<br/>
            Building Chat/Text/Search AI Apps<br/>
            Securing AI Apps<br/>
            RAG, Open Source Models<br/>
            AI Agents & LLM Fine-Tuning<br/>
            These skills are becoming mandatory for modern job roles.
          </li>
          <li>
            <strong>Improve Digital & Business Skills</strong><br/>
            Technical skills are important — but employers also look for digital awareness and business understanding.<br/>
            Helpful courses:<br/>
            Digital Marketing Essentials – Infosys Springboard<br/>
            AWS Cloud Practitioner Essentials – AWS<br/>
            Business Analytics Basics – Cisco<br/>
            These help you perform better in real work situations.
          </li>
          <li>
            <strong>Apply Your Learning Through Projects</strong><br/>
            Courses alone are not enough.<br/><br/>
            Choose at least one small project after each course:<br/>
            Build a resume analyzer with AI<br/>
            Create a simple SQL dashboard<br/>
            Make an image generation app<br/>
            Analyse a dataset and present insights<br/>
            Projects show employers that you can apply what you've learned.
          </li>
          <li>
            <strong>Keep Your Certifications Updated on LinkedIn</strong><br/>
            After completing a course, add the certificate to your LinkedIn profile and resume.<br/><br/>
            This increases profile visibility and helps recruiters trust your skills.
          </li>
          <li>
            <strong>Build a Habit of Learning</strong><br/>
            Spend 30–45 minutes a day learning something new.<br/><br/>
            Small progress daily leads to major transformation within 2–3 months.
          </li>
          <li>
            <strong>Choose Skills Aligned With Your Career Goals</strong><br/>
            Before you start learning everything, ask yourself:<br/>
            What job am I targeting?<br/>
            What skills do recruiters expect?<br/>
            Which skill will help me grow the fastest?<br/>
            Focus on skills that support your job role, not random learning.
          </li>
        </ol>
        
        <div class="mt-6">
          <h4 class="font-bold text-gray-900 mb-2">Free Resources:</h4>
          <ul class="list-disc pl-5 space-y-2 text-gray-600">
            <li><a href="https://free-generative-ai-cours-ir6segl.gamma.site/" target="_blank" rel="noopener noreferrer" class="text-[#01796F] hover:underline">Free Generative AI Course Collection</a></li>
            <li><a href="https://18-free-courses-t2s6eq1.gamma.site/" target="_blank" rel="noopener noreferrer" class="text-[#01796F] hover:underline">18 Free Courses Collection</a></li>
            <li><a href="https://free-certified-courses-b-mt6crpl.gamma.site/" target="_blank" rel="noopener noreferrer" class="text-[#01796F] hover:underline">Free Certified Courses Bundle</a></li>
          </ul>
        </div>
      `
    }
  ];

  return (
    <div className="min-h-screen bg-white flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div 
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 transition-transform duration-300 ease-in-out`}
      >
        <Sidebar userEmail={user?.email || ''} onLogout={handleLogout} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar for mobile */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-gray-200">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="font-bold text-xl text-[#0B4F6C]">careercast</div>
          <div className="w-10"></div> {/* Spacer for alignment */}
        </div>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-gray-50">
          <div className="max-w-6xl mx-auto">
            <div className="mb-6 sm:mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Career Resources</h1>
              <p className="text-gray-600 text-sm sm:text-base">
                Enhance your career prospects with our curated collection of professional resources
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {resources.map((resource, index) => (
                <div
                  key={index}
                  className="bg-white rounded-lg sm:rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-all group cursor-pointer"
                  onClick={() => setSelectedResource(index)}
                >
                  <div className={`w-12 h-12 bg-gradient-to-br ${resource.color} rounded-lg flex items-center justify-center mb-4`}>
                    <resource.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 text-base sm:text-lg group-hover:text-[#01796F] transition-colors">
                    {resource.title}
                  </h3>
                  <p className="text-gray-600 text-sm sm:text-base">
                    {resource.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Resource Detail Modal */}
        {selectedResource !== null && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg sm:rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6 flex justify-between items-center rounded-t-lg sm:rounded-t-xl">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                  {resources[selectedResource].title}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div 
                className="p-4 sm:p-6"
                dangerouslySetInnerHTML={{ __html: resources[selectedResource].detailedContent }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}