import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Alert, AlertDescription } from './ui/alert';
import { CheckCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favorite movie?"
];

const SetupWizard = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [systemCheck, setSystemCheck] = useState(null);
  
  // Step 1: System Requirements
  const [requirementsMet, setRequirementsMet] = useState(false);
  
  // Step 2: Service Configuration
  const [serviceName, setServiceName] = useState('');
  const [domainName, setDomainName] = useState('');
  
  // Step 3: Admin Account
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestions, setSecurityQuestions] = useState([
    { question: SECURITY_QUESTIONS[0], answer: '' },
    { question: SECURITY_QUESTIONS[1], answer: '' },
    { question: SECURITY_QUESTIONS[2], answer: '' }
  ]);
  
  // Step 4: Channels
  const [channelCount, setChannelCount] = useState(25);
  const [startingNumber, setStartingNumber] = useState(100);

  useEffect(() => {
    checkSystemRequirements();
  }, []);

  const checkSystemRequirements = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/setup/status`);
      setSystemCheck(response.data);
      
      const allMet = response.data.system_requirements.all_requirements_met;
      setRequirementsMet(allMet);
      
      if (allMet) {
        toast.success('All system requirements met!');
      } else {
        toast.warning('Some requirements not met');
      }
      
      if (response.data.setup_completed) {
        toast.info('Setup already completed');
        onComplete && onComplete();
      }
    } catch (error) {
      console.error('Error checking system:', error);
      toast.error('Failed to check system requirements');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceConfig = async () => {
    if (!serviceName.trim()) {
      toast.error('Service name is required');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API}/setup/service-config`, null, {
        params: {
          service_name: serviceName,
          domain_name: domainName || null
        }
      });
      toast.success('Service configured');
      setStep(3);
    } catch (error) {
      toast.error('Failed to configure service');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSetup = async () => {
    if (!adminUsername || !adminPassword) {
      toast.error('Username and password are required');
      return;
    }
    
    if (adminPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (adminPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    
    const unanswered = securityQuestions.filter(q => !q.answer.trim());
    if (unanswered.length > 0) {
      toast.error('Please answer all security questions');
      return;
    }
    
    setLoading(true);
    try {
      await axios.post(`${API}/setup/admin`, null, {
        params: {
          username: adminUsername,
          password: adminPassword
        },
        data: {
          security_questions: securityQuestions
        }
      });
      toast.success('Admin account created');
      setStep(4);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create admin');
    } finally {
      setLoading(false);
    }
  };

  const handleChannelSetup = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/setup/bulk-channels`, null, {
        params: {
          count: channelCount,
          starting_number: startingNumber
        }
      });
      toast.success(`Created ${channelCount} channels`);
      setStep(5);
    } catch (error) {
      toast.error('Failed to create channels');
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/setup/complete`);
      toast.success('Setup completed successfully!');
      onComplete && onComplete();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to complete setup');
    } finally {
      setLoading(false);
    }
  };

  const updateSecurityQuestion = (index, field, value) => {
    const updated = [...securityQuestions];
    updated[index][field] = value;
    setSecurityQuestions(updated);
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl bg-[#2a2a2a] border-gray-700">
        <CardHeader>
          <CardTitle className="text-3xl text-white">Setup Wizard</CardTitle>
          <CardDescription className="text-gray-400">
            Step {step} of 5 - Configure your TV Service
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Step 1: System Requirements */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-xl text-white font-semibold">System Requirements Check</h3>
              
              {systemCheck?.system_requirements?.checks && (
                <div className="space-y-3">
                  {Object.entries(systemCheck.system_requirements.checks).map(([key, check]) => (
                    <div key={key} className="flex items-center justify-between p-3 bg-[#1a1a1a] rounded">
                      <div className="flex items-center gap-3">
                        {check.status ? (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        <div>
                          <p className="text-white font-medium capitalize">{key.replace('_', ' ')}</p>
                          <p className="text-sm text-gray-400">{check.message}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500">{check.required}</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex justify-between pt-4">
                <Button
                  onClick={checkSystemRequirements}
                  variant="outline"
                  className="bg-transparent border-gray-600 text-white"
                >
                  Recheck
                </Button>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!requirementsMet}
                  className="bg-[#0056A8] hover:bg-[#0066c8]"
                >
                  Continue <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: Service Configuration */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-xl text-white font-semibold">Service Configuration</h3>
              
              <div className="space-y-2">
                <Label htmlFor="serviceName" className="text-white">Service Name *</Label>
                <Input
                  id="serviceName"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="e.g., Premium TV Service"
                  className="bg-[#1a1a1a] border-gray-600 text-white"
                />
                <p className="text-xs text-gray-400">This name will appear throughout the system</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="domainName" className="text-white">Domain Name (Optional)</Label>
                <Input
                  id="domainName"
                  value={domainName}
                  onChange={(e) => setDomainName(e.target.value)}
                  placeholder="e.g., tv.yourdomain.com"
                  className="bg-[#1a1a1a] border-gray-600 text-white"
                />
              </div>
              
              <div className="flex justify-between pt-4">
                <Button
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="bg-transparent border-gray-600 text-white"
                >
                  Back
                </Button>
                <Button
                  onClick={handleServiceConfig}
                  disabled={loading}
                  className="bg-[#0056A8] hover:bg-[#0066c8]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Admin Account */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-xl text-white font-semibold">Create Admin Account</h3>
              
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white">Username *</Label>
                <Input
                  id="username"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="admin"
                  className="bg-[#1a1a1a] border-gray-600 text-white"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-[#1a1a1a] border-gray-600 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-white">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-[#1a1a1a] border-gray-600 text-white"
                  />
                </div>
              </div>
              
              <div className="space-y-3 pt-2">
                <p className="text-white font-medium">Security Questions</p>
                {securityQuestions.map((sq, index) => (
                  <div key={index} className="space-y-2">
                    <Label className="text-white text-sm">{sq.question}</Label>
                    <Input
                      value={sq.answer}
                      onChange={(e) => updateSecurityQuestion(index, 'answer', e.target.value)}
                      placeholder="Your answer"
                      className="bg-[#1a1a1a] border-gray-600 text-white"
                    />
                  </div>
                ))}
              </div>
              
              <div className="flex justify-between pt-4">
                <Button
                  onClick={() => setStep(2)}
                  variant="outline"
                  className="bg-transparent border-gray-600 text-white"
                >
                  Back
                </Button>
                <Button
                  onClick={handleAdminSetup}
                  disabled={loading}
                  className="bg-[#0056A8] hover:bg-[#0066c8]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Continue'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Channel Setup */}
          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-xl text-white font-semibold">Channel Setup</h3>
              
              <Alert className="bg-blue-900/20 border-blue-900">
                <AlertDescription className="text-blue-400">
                  Create initial channels that you can customize later in the admin dashboard
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">
                <Label htmlFor="channelCount" className="text-white">Number of Channels (25-100)</Label>
                <Input
                  id="channelCount"
                  type="number"
                  min="25"
                  max="100"
                  value={channelCount}
                  onChange={(e) => setChannelCount(parseInt(e.target.value))}
                  className="bg-[#1a1a1a] border-gray-600 text-white"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="startingNumber" className="text-white">Starting Channel Number</Label>
                <Input
                  id="startingNumber"
                  type="number"
                  value={startingNumber}
                  onChange={(e) => setStartingNumber(parseInt(e.target.value))}
                  className="bg-[#1a1a1a] border-gray-600 text-white"
                />
                <p className="text-xs text-gray-400">
                  Channels will be numbered {startingNumber} to {startingNumber + channelCount - 1}
                </p>
              </div>
              
              <div className="flex justify-between pt-4">
                <Button
                  onClick={() => setStep(3)}
                  variant="outline"
                  className="bg-transparent border-gray-600 text-white"
                >
                  Back
                </Button>
                <Button
                  onClick={handleChannelSetup}
                  disabled={loading}
                  className="bg-[#0056A8] hover:bg-[#0066c8]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Channels'}
                </Button>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 5 && (
            <div className="space-y-4">
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl text-white font-semibold mb-2">Setup Complete!</h3>
                <p className="text-gray-400">Your TV service is ready to use</p>
              </div>
              
              <div className="bg-[#1a1a1a] p-4 rounded space-y-2">
                <p className="text-white font-medium">What's Next:</p>
                <ul className="text-gray-400 text-sm space-y-1 list-disc list-inside">
                  <li>Login to the admin dashboard with your credentials</li>
                  <li>Customize your {channelCount} channels (add logos, names, descriptions)</li>
                  <li>Add EPG programs to your channels</li>
                  <li>Create devices for your customers</li>
                  <li>Configure additional settings</li>
                </ul>
              </div>
              
              <div className="flex justify-center pt-4">
                <Button
                  onClick={handleComplete}
                  disabled={loading}
                  className="bg-[#0056A8] hover:bg-[#0066c8] px-8"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Go to Dashboard'}
                </Button>
              </div>
            </div>
          )}
          
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupWizard;
