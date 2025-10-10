import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, DollarSign, TrendingUp, PiggyBank } from 'lucide-react';

export const FinancialCalculators: React.FC = () => {
  const [loanValues, setLoanValues] = useState({
    amount: '',
    rate: '',
    term: '',
    result: 0
  });

  const [compoundValues, setCompoundValues] = useState({
    principal: '',
    rate: '',
    time: '',
    compound: '12',
    result: 0
  });

  const [mortgageValues, setMortgageValues] = useState({
    homePrice: '',
    downPayment: '',
    rate: '',
    term: '',
    result: 0
  });

  const calculateLoanPayment = () => {
    const P = parseFloat(loanValues.amount);
    const r = parseFloat(loanValues.rate) / 100 / 12;
    const n = parseFloat(loanValues.term) * 12;
    
    if (P && r && n) {
      const payment = P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      setLoanValues(prev => ({ ...prev, result: payment }));
    }
  };

  const calculateCompoundInterest = () => {
    const P = parseFloat(compoundValues.principal);
    const r = parseFloat(compoundValues.rate) / 100;
    const t = parseFloat(compoundValues.time);
    const n = parseFloat(compoundValues.compound);
    
    if (P && r && t && n) {
      const amount = P * Math.pow(1 + r / n, n * t);
      setCompoundValues(prev => ({ ...prev, result: amount }));
    }
  };

  const calculateMortgage = () => {
    const homePrice = parseFloat(mortgageValues.homePrice);
    const downPayment = parseFloat(mortgageValues.downPayment);
    const rate = parseFloat(mortgageValues.rate) / 100 / 12;
    const term = parseFloat(mortgageValues.term) * 12;
    
    const loanAmount = homePrice - downPayment;
    
    if (loanAmount && rate && term) {
      const payment = loanAmount * (rate * Math.pow(1 + rate, term)) / (Math.pow(1 + rate, term) - 1);
      setMortgageValues(prev => ({ ...prev, result: payment }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Calculator className="h-6 w-6 text-blue-600" />
        <h2 className="text-2xl font-bold">Financial Calculators</h2>
      </div>

      <Tabs defaultValue="loan" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="loan">Loan Payment</TabsTrigger>
          <TabsTrigger value="compound">Compound Interest</TabsTrigger>
          <TabsTrigger value="mortgage">Mortgage</TabsTrigger>
          <TabsTrigger value="savings">Savings Goal</TabsTrigger>
        </TabsList>

        <TabsContent value="loan">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Loan Payment Calculator
              </CardTitle>
              <CardDescription>
                Calculate monthly loan payments based on loan amount, interest rate, and term.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="loan-amount">Loan Amount (R)</Label>
                  <Input
                    id="loan-amount"
                    type="number"
                    placeholder="100000"
                    value={loanValues.amount}
                    onChange={(e) => setLoanValues(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loan-rate">Interest Rate (%)</Label>
                  <Input
                    id="loan-rate"
                    type="number"
                    step="0.01"
                    placeholder="7.5"
                    value={loanValues.rate}
                    onChange={(e) => setLoanValues(prev => ({ ...prev, rate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loan-term">Term (Years)</Label>
                  <Input
                    id="loan-term"
                    type="number"
                    placeholder="30"
                    value={loanValues.term}
                    onChange={(e) => setLoanValues(prev => ({ ...prev, term: e.target.value }))}
                  />
                </div>
              </div>
              <Button onClick={calculateLoanPayment} className="w-full">
                Calculate Payment
              </Button>
              {loanValues.result > 0 && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-lg font-semibold">
                    Monthly Payment: R{loanValues.result.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compound">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Compound Interest Calculator
              </CardTitle>
              <CardDescription>
                Calculate compound interest on your investments over time.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="compound-principal">Principal (R)</Label>
                  <Input
                    id="compound-principal"
                    type="number"
                    placeholder="10000"
                    value={compoundValues.principal}
                    onChange={(e) => setCompoundValues(prev => ({ ...prev, principal: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compound-rate">Interest Rate (%)</Label>
                  <Input
                    id="compound-rate"
                    type="number"
                    step="0.01"
                    placeholder="8.5"
                    value={compoundValues.rate}
                    onChange={(e) => setCompoundValues(prev => ({ ...prev, rate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compound-time">Time (Years)</Label>
                  <Input
                    id="compound-time"
                    type="number"
                    placeholder="10"
                    value={compoundValues.time}
                    onChange={(e) => setCompoundValues(prev => ({ ...prev, time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="compound-frequency">Compound Frequency</Label>
                  <select
                    id="compound-frequency"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={compoundValues.compound}
                    onChange={(e) => setCompoundValues(prev => ({ ...prev, compound: e.target.value }))}
                  >
                    <option value="1">Annually</option>
                    <option value="4">Quarterly</option>
                    <option value="12">Monthly</option>
                    <option value="365">Daily</option>
                  </select>
                </div>
              </div>
              <Button onClick={calculateCompoundInterest} className="w-full">
                Calculate Interest
              </Button>
              {compoundValues.result > 0 && (
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-lg font-semibold">
                    Final Amount: R{compoundValues.result.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-gray-600">
                    Interest Earned: R{(compoundValues.result - parseFloat(compoundValues.principal)).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mortgage">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5" />
                Mortgage Calculator
              </CardTitle>
              <CardDescription>
                Calculate monthly mortgage payments including principal and interest.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="home-price">Home Price (R)</Label>
                  <Input
                    id="home-price"
                    type="number"
                    placeholder="1500000"
                    value={mortgageValues.homePrice}
                    onChange={(e) => setMortgageValues(prev => ({ ...prev, homePrice: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="down-payment">Down Payment (R)</Label>
                  <Input
                    id="down-payment"
                    type="number"
                    placeholder="300000"
                    value={mortgageValues.downPayment}
                    onChange={(e) => setMortgageValues(prev => ({ ...prev, downPayment: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mortgage-rate">Interest Rate (%)</Label>
                  <Input
                    id="mortgage-rate"
                    type="number"
                    step="0.01"
                    placeholder="9.5"
                    value={mortgageValues.rate}
                    onChange={(e) => setMortgageValues(prev => ({ ...prev, rate: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mortgage-term">Term (Years)</Label>
                  <Input
                    id="mortgage-term"
                    type="number"
                    placeholder="20"
                    value={mortgageValues.term}
                    onChange={(e) => setMortgageValues(prev => ({ ...prev, term: e.target.value }))}
                  />
                </div>
              </div>
              <Button onClick={calculateMortgage} className="w-full">
                Calculate Mortgage
              </Button>
              {mortgageValues.result > 0 && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-lg font-semibold">
                    Monthly Payment: R{mortgageValues.result.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-sm text-gray-600">
                    Loan Amount: R{(parseFloat(mortgageValues.homePrice) - parseFloat(mortgageValues.downPayment)).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="savings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PiggyBank className="h-5 w-5" />
                Savings Goal Calculator
              </CardTitle>
              <CardDescription>
                Calculate how much you need to save monthly to reach your goal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-8">
                <p className="text-gray-500">Coming Soon - Additional savings calculators will be implemented here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};