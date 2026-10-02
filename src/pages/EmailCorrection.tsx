import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export default function EmailCorrection() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        awlId: "",
        phoneNumber: "",
        newEmail: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!formData.awlId.trim() || !formData.phoneNumber.trim() || !formData.newEmail.trim()) {
            setError("Please fill in all fields.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/email-correction", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    awlId: formData.awlId.trim(),
                    phoneNumber: formData.phoneNumber.trim(),
                    newEmail: formData.newEmail.trim().toLowerCase(),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to update your email. Please try again.");
            }

            setSuccess(true);
        } catch (err: any) {
            setError(err.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 py-10">
            <div className="w-full px-4 sm:px-8 lg:px-16">
                <div className="flex justify-center">
                    <div className="w-full max-w-md">
                        <Card className="p-6 sm:p-8 border border-slate-200 rounded-2xl shadow-sm bg-white">
                            <div className="text-center mb-8">
                                <span className="text-xl font-bold text-slate-900 font-noto">
                                    Email Correction
                                </span>
                                <p className="text-slate-500 text-sm mt-2">
                                    Entered the wrong email during registration? Verify your details below to update it.
                                </p>
                            </div>

                            {success ? (
                                <div className="text-center py-4">
                                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                                    <p className="text-slate-900 font-semibold mb-2">
                                        Your email has been updated successfully.
                                    </p>
                                    <p className="text-slate-600 text-sm mb-6">
                                        Please use your new email to log in.
                                    </p>
                                    <Button
                                        onClick={() => navigate("/auth")}
                                        className="w-full h-12 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-all"
                                    >
                                        Go to Login
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    {error && (
                                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                            {error}
                                        </div>
                                    )}

                                    <form onSubmit={handleSubmit}>
                                        <div className="mb-4">
                                            <label className="block text-slate-900 font-semibold mb-2 text-sm">
                                                AWL ID
                                            </label>
                                            <Input
                                                type="text"
                                                name="awlId"
                                                value={formData.awlId}
                                                onChange={handleInputChange}
                                                className="w-full h-12 px-4 border border-slate-300 rounded-lg focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 transition-all"
                                                placeholder="Enter your AWL ID"
                                                required
                                            />
                                        </div>

                                        <div className="mb-4">
                                            <label className="block text-slate-900 font-semibold mb-2 text-sm">
                                                Phone Number
                                            </label>
                                            <Input
                                                type="tel"
                                                name="phoneNumber"
                                                value={formData.phoneNumber}
                                                onChange={handleInputChange}
                                                className="w-full h-12 px-4 border border-slate-300 rounded-lg focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 transition-all"
                                                placeholder="Enter the phone number on file"
                                                required
                                            />
                                        </div>

                                        <div className="mb-6">
                                            <label className="block text-slate-900 font-semibold mb-2 text-sm">
                                                Correct Email Address
                                            </label>
                                            <Input
                                                type="email"
                                                name="newEmail"
                                                value={formData.newEmail}
                                                onChange={handleInputChange}
                                                onInput={(e: any) => (e.target.value = e.target.value.toLowerCase())}
                                                className="w-full h-12 px-4 border border-slate-300 rounded-lg focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 transition-all"
                                                placeholder="Enter your correct email address"
                                                required
                                            />
                                        </div>

                                        <Button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full h-12 bg-slate-900 text-white font-semibold rounded-lg transition-all duration-300 hover:bg-slate-800 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {loading ? "Submitting..." : "Submit"}
                                        </Button>
                                    </form>
                                </>
                            )}

                            <div className="text-center mt-6">
                                <button
                                    onClick={() => navigate("/auth")}
                                    className="text-slate-600 hover:text-slate-800 transition-colors flex items-center justify-center gap-2"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    Back to Login
                                </button>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}