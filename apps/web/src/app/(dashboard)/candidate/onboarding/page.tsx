"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import {
  CRYPTO_INTERESTS,
  CRYPTO_ROLE_TITLES,
  EXPERIENCE_LEVELS,
  AVAILABILITY_OPTIONS,
  REMOTE_PREFERENCES,
} from "@techchain/lib/src/schemas";

const STEPS = ["Profile", "Career", "Links", "Consent"];

export default function CandidateOnboardingPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    // Profile
    fullName: "",
    location: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    phone: "",

    // Career
    desiredRoleTitles: [] as string[],
    experienceLevel: "",
    availability: "",
    remotePreference: "",
    salaryExpectation: "",
    cryptoInterests: [] as string[],

    // Links
    linkedinUrl: "",
    githubUrl: "",
    twitterUrl: "",
    websiteUrl: "",
    linkedinAboutPaste: "",

    // Consent
    consentToProcess: false,
    consentToAnalyzeFootprint: false,
    consentToAnalyzeGithub: false,
    consentToBeContacted: false,
  });

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const toggleArrayField = (field: string, value: string) => {
    setFormData((prev) => {
      const arr = (prev as any)[field] as string[];
      if (arr.includes(value)) {
        return { ...prev, [field]: arr.filter((v) => v !== value) };
      }
      return { ...prev, [field]: [...arr, value] };
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/candidates/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            fullName: formData.fullName,
            location: formData.location,
            timezone: formData.timezone,
            phone: formData.phone,
            desiredRoleTitles: formData.desiredRoleTitles,
            experienceLevel: formData.experienceLevel,
            availability: formData.availability,
            remotePreference: formData.remotePreference,
            salaryExpectation: formData.salaryExpectation,
            cryptoInterests: formData.cryptoInterests,
            linkedinUrl: formData.linkedinUrl,
            githubUrl: formData.githubUrl,
            twitterUrl: formData.twitterUrl,
            websiteUrl: formData.websiteUrl,
            linkedinAboutPaste: formData.linkedinAboutPaste,
          },
          consent: {
            consentToProcess: formData.consentToProcess,
            consentToAnalyzeFootprint: formData.consentToAnalyzeFootprint,
            consentToAnalyzeGithub: formData.consentToAnalyzeGithub,
            consentToBeContacted: formData.consentToBeContacted,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create profile");
      }

      toast({
        title: "Profile created!",
        description: "Your profile has been created. Running your first assessment...",
      });

      // Trigger assessment
      await fetch("/api/candidates/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      router.push("/dashboard");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return formData.fullName && formData.location && formData.timezone;
      case 1:
        return (
          formData.desiredRoleTitles.length > 0 &&
          formData.experienceLevel &&
          formData.availability &&
          formData.cryptoInterests.length > 0
        );
      case 2:
        return true; // Links are optional
      case 3:
        return formData.consentToProcess;
      default:
        return false;
    }
  };

  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Join TechChain Talent Hub</h1>
        <p className="text-muted-foreground">
          Complete your profile to get personalized crypto career coaching
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Step {step + 1} of {STEPS.length}: {STEPS[step]}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
          <CardDescription>
            {step === 0 && "Tell us about yourself"}
            {step === 1 && "What are you looking for?"}
            {step === 2 && "Share your online presence"}
            {step === 3 && "Review and consent"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 0: Profile */}
          {step === 0 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => updateField("fullName", e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => updateField("location", e.target.value)}
                  placeholder="San Francisco, CA"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone *</Label>
                <Input
                  id="timezone"
                  value={formData.timezone}
                  onChange={(e) => updateField("timezone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="+1 555 123 4567"
                />
              </div>
            </>
          )}

          {/* Step 1: Career */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Desired Roles * (select all that apply)</Label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {CRYPTO_ROLE_TITLES.map((role) => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        id={`role-${role}`}
                        checked={formData.desiredRoleTitles.includes(role)}
                        onCheckedChange={() =>
                          toggleArrayField("desiredRoleTitles", role)
                        }
                      />
                      <label
                        htmlFor={`role-${role}`}
                        className="text-sm cursor-pointer"
                      >
                        {role}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Experience Level *</Label>
                <Select
                  value={formData.experienceLevel}
                  onValueChange={(v) => updateField("experienceLevel", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select level" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPERIENCE_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Availability *</Label>
                <Select
                  value={formData.availability}
                  onValueChange={(v) => updateField("availability", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select availability" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABILITY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Remote Preference</Label>
                <Select
                  value={formData.remotePreference}
                  onValueChange={(v) => updateField("remotePreference", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select preference" />
                  </SelectTrigger>
                  <SelectContent>
                    {REMOTE_PREFERENCES.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Crypto Interests * (select all that apply)</Label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {CRYPTO_INTERESTS.map((interest) => (
                    <div key={interest} className="flex items-center space-x-2">
                      <Checkbox
                        id={`interest-${interest}`}
                        checked={formData.cryptoInterests.includes(interest)}
                        onCheckedChange={() =>
                          toggleArrayField("cryptoInterests", interest)
                        }
                      />
                      <label
                        htmlFor={`interest-${interest}`}
                        className="text-sm cursor-pointer"
                      >
                        {interest}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Step 2: Links */}
          {step === 2 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="linkedinUrl">LinkedIn URL</Label>
                <Input
                  id="linkedinUrl"
                  type="url"
                  value={formData.linkedinUrl}
                  onChange={(e) => updateField("linkedinUrl", e.target.value)}
                  placeholder="https://linkedin.com/in/yourprofile"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="githubUrl">GitHub URL</Label>
                <Input
                  id="githubUrl"
                  type="url"
                  value={formData.githubUrl}
                  onChange={(e) => updateField("githubUrl", e.target.value)}
                  placeholder="https://github.com/yourusername"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitterUrl">Twitter/X URL</Label>
                <Input
                  id="twitterUrl"
                  type="url"
                  value={formData.twitterUrl}
                  onChange={(e) => updateField("twitterUrl", e.target.value)}
                  placeholder="https://twitter.com/yourhandle"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="websiteUrl">Personal Website</Label>
                <Input
                  id="websiteUrl"
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => updateField("websiteUrl", e.target.value)}
                  placeholder="https://yoursite.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedinAboutPaste">
                  LinkedIn About/Experience (paste here)
                </Label>
                <Textarea
                  id="linkedinAboutPaste"
                  value={formData.linkedinAboutPaste}
                  onChange={(e) =>
                    updateField("linkedinAboutPaste", e.target.value)
                  }
                  placeholder="Copy and paste your LinkedIn About section and key experience here..."
                  rows={6}
                />
              </div>
            </>
          )}

          {/* Step 3: Consent */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="p-4 bg-muted rounded-lg space-y-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="consentToProcess"
                    checked={formData.consentToProcess}
                    onCheckedChange={(checked) =>
                      updateField("consentToProcess", checked)
                    }
                  />
                  <div>
                    <label
                      htmlFor="consentToProcess"
                      className="font-medium cursor-pointer"
                    >
                      I consent to data processing *
                    </label>
                    <p className="text-sm text-muted-foreground">
                      I agree to have my profile data processed for the purpose
                      of providing career assessments and recommendations.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="consentToAnalyzeFootprint"
                    checked={formData.consentToAnalyzeFootprint}
                    onCheckedChange={(checked) =>
                      updateField("consentToAnalyzeFootprint", checked)
                    }
                  />
                  <div>
                    <label
                      htmlFor="consentToAnalyzeFootprint"
                      className="font-medium cursor-pointer"
                    >
                      Analyze my digital footprint (recommended)
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Allow us to analyze your provided links and pasted content
                      to generate a more accurate Crypto Native Score.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="consentToAnalyzeGithub"
                    checked={formData.consentToAnalyzeGithub}
                    onCheckedChange={(checked) =>
                      updateField("consentToAnalyzeGithub", checked)
                    }
                  />
                  <div>
                    <label
                      htmlFor="consentToAnalyzeGithub"
                      className="font-medium cursor-pointer"
                    >
                      Analyze my GitHub profile
                    </label>
                    <p className="text-sm text-muted-foreground">
                      Allow us to fetch your public GitHub repositories for
                      technical skill scoring.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="consentToBeContacted"
                    checked={formData.consentToBeContacted}
                    onCheckedChange={(checked) =>
                      updateField("consentToBeContacted", checked)
                    }
                  />
                  <div>
                    <label
                      htmlFor="consentToBeContacted"
                      className="font-medium cursor-pointer"
                    >
                      Allow recruiters to contact me
                    </label>
                    <p className="text-sm text-muted-foreground">
                      If enabled, approved recruiters may reach out about
                      relevant opportunities.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-6 border-t">
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
            >
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
                Continue
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canProceed() || isSubmitting}>
                {isSubmitting ? "Creating profile..." : "Complete Profile"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
