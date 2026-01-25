import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">TC</span>
            </div>
            <span className="font-semibold text-xl">TechChain Talent Hub</span>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/auth/signin">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth/signin?callbackUrl=/onboarding">
              <Button>Get Started</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <Badge className="mb-4" variant="secondary">
          The Premier Crypto Recruiting Marketplace
        </Badge>
        <h1 className="text-5xl font-bold tracking-tight mb-6">
          Connect Top Crypto Talent
          <br />
          with Leading Web3 Companies
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Whether you're a recruiter looking to earn commissions, a company searching for
          exceptional talent, or a candidate ready to launch your crypto career—TechChain
          Talent Hub is your destination.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/auth/signin?role=recruiter">
            <Button size="lg">I'm a Recruiter</Button>
          </Link>
          <Link href="/auth/signin?role=candidate">
            <Button size="lg" variant="outline">I'm a Candidate</Button>
          </Link>
          <Link href="/auth/signin?role=company">
            <Button size="lg" variant="secondary">I'm Hiring</Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          {/* For Recruiters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">💼</span>
                For Recruiters
              </CardTitle>
              <CardDescription>
                Access exclusive crypto roles and earn commissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Access live roles from top crypto companies
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Competitive commissions (15-25% of salary)
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Fast payouts via Stripe Connect
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  AI-powered candidate matching
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* For Candidates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🚀</span>
                For Candidates
              </CardTitle>
              <CardDescription>
                Boost your crypto career with personalized coaching
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Get your Crypto Native Score
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  GitHub-based skill assessment
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Personalized 30/60/90 day career plan
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Role fit analysis for your target jobs
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* For Companies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-2xl">🏢</span>
                For Companies
              </CardTitle>
              <CardDescription>
                Find pre-vetted crypto talent quickly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Access network of experienced recruiters
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  AI-scored candidates with crypto expertise
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Pay only when candidates start
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-500">✓</span>
                  Hidden talent recommendations
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-slate-50 py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-indigo-600 font-bold">1</span>
              </div>
              <h3 className="font-semibold mb-2">Sign Up</h3>
              <p className="text-sm text-muted-foreground">
                Create your account as a recruiter, candidate, or company
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-indigo-600 font-bold">2</span>
              </div>
              <h3 className="font-semibold mb-2">Complete Profile</h3>
              <p className="text-sm text-muted-foreground">
                Fill out your profile and get verified
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-indigo-600 font-bold">3</span>
              </div>
              <h3 className="font-semibold mb-2">Get Matched</h3>
              <p className="text-sm text-muted-foreground">
                AI matches you with the right opportunities
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-indigo-600 font-bold">4</span>
              </div>
              <h3 className="font-semibold mb-2">Success</h3>
              <p className="text-sm text-muted-foreground">
                Land roles, earn commissions, grow your career
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
        <p className="text-muted-foreground mb-8">
          Join the leading recruiting marketplace for crypto talent
        </p>
        <Link href="/auth/signin">
          <Button size="lg">Create Free Account</Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} TechChain Talent Hub. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
