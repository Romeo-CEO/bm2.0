import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calculator, TrendingUp, BarChart, DollarSign } from 'lucide-react';

export const BusinessCalculators: React.FC = () => {
  const [roiValues, setRoiValues] = useState({
    investment: '',
    gain: '',
    result: 0
  });

  const [breakEvenValues, setBreakEvenValues] = useState({
    fixedCosts: '',
    pricePerUnit: '',
    variableCostPerUnit: '',
    result: 0
  });

  const [marginValues, setMarginValues] = useState({
    revenue: '',
    cost: '',
    result: 0
  });

  const calculateROI = () => {
    const investment = parseFloat(roiValues.investment);
    const gain = parseFloat(roiValues.gain);
    
    if (investment && gain) {
      const roi = ((gain - investment) / investment) * 100;
      setRoiValues(prev => ({ ...prev, result: roi }));
    }
  };

  const calculateBreakEven = () => {
    const fixedCosts = parseFloat(breakEvenValues.fixedCosts);
    const pricePerUnit = parseFloat(breakEvenValues.pricePerUnit);
    const variableCostPerUnit = parseFloat(breakEvenValues.variableCostPerUnit);
    
    if (fixedCosts && pricePerUnit && variableCostPerUnit) {
      const breakEvenUnits = fixedCosts / (pricePerUnit - variableCostPerUnit);
      setBreakEvenValues(prev => ({ ...prev, result: breakEvenUnits }));
    }
  };

  const calculateMargin = () => {
    const revenue = parseFloat(marginValues.revenue);
    const cost = parseFloat(marginValues.cost);
    
    if (revenue && cost) {
      const margin = ((revenue - cost) / revenue) * 100;
      setMarginValues(prev => ({ ...prev, result: margin }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <BarChart className="h-6 w-6 text-green-600" />
        <h2 className="text-2xl font-bold">Business Calculators</h2>
      </div>

      <Tabs defaultValue="roi" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="roi">ROI Calculator</TabsTrigger>
          <TabsTrigger value="breakeven">Break Even</TabsTrigger>
          <TabsTrigger value="margin">Profit Margin</TabsTrigger>
          <TabsTrigger value="depreciation">Depreciation</TabsTrigger>
        </TabsList>

        <TabsContent value="roi">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Return on Investment Calculator
              </CardTitle>
              <CardDescription>
                Calculate the return on investment (ROI) for your business investments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="investment">Initial Investment (R)</Label>
                  <Input
                    id="investment"
                    type="number"
                    placeholder="100000"
                    value={roiValues.investment}
                    onChange={(e) => setRoiValues(prev => ({ ...prev, investment: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gain">Final Value (R)</Label>
                  <Input
                    id="gain"
                    type="number"
                    placeholder="150000"
                    value={roiValues.gain}
                    onChange={(e) => setRoiValues(prev => ({ ...prev, gain: e.target.value }))}
                  />
                </div>
              </div>
              <Button onClick={calculateROI} className="w-full">
                Calculate ROI
              </Button>
              {roiValues.result !== 0 && (
                <div className={`p-4 rounded-lg ${roiValues.result > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="text-lg font-semibold">
                    ROI: {roiValues.result.toFixed(2)}%
                  </p>
                  <p className="text-sm text-gray-600">
                    {roiValues.result > 0 ? 'Profitable Investment' : 'Loss on Investment'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakeven">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5" />
                Break Even Analysis
              </CardTitle>
              <CardDescription>
                Calculate the number of units you need to sell to break even.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fixed-costs">Fixed Costs (R)</Label>
                  <Input
                    id="fixed-costs"
                    type="number"
                    placeholder="50000"
                    value={breakEvenValues.fixedCosts}
                    onChange={(e) => setBreakEvenValues(prev => ({ ...prev, fixedCosts: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price-per-unit">Price per Unit (R)</Label>
                  <Input
                    id="price-per-unit"
                    type="number"
                    placeholder="100"
                    value={breakEvenValues.pricePerUnit}
                    onChange={(e) => setBreakEvenValues(prev => ({ ...prev, pricePerUnit: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="variable-cost">Variable Cost per Unit (R)</Label>
                  <Input
                    id="variable-cost"
                    type="number"
                    placeholder="40"
                    value={breakEvenValues.variableCostPerUnit}
                    onChange={(e) => setBreakEvenValues(prev => ({ ...prev, variableCostPerUnit: e.target.value }))}
                  />
                </div>
              </div>
              <Button onClick={calculateBreakEven} className="w-full">
                Calculate Break Even
              </Button>
              {breakEvenValues.result > 0 && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-lg font-semibold">
                    Break Even Point: {Math.ceil(breakEvenValues.result)} units
                  </p>
                  <p className="text-sm text-gray-600">
                    Revenue needed: R{(Math.ceil(breakEvenValues.result) * parseFloat(breakEvenValues.pricePerUnit)).toLocaleString('en-ZA')}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="margin">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Profit Margin Calculator
              </CardTitle>
              <CardDescription>
                Calculate your profit margin percentage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="revenue">Revenue (R)</Label>
                  <Input
                    id="revenue"
                    type="number"
                    placeholder="100000"
                    value={marginValues.revenue}
                    onChange={(e) => setMarginValues(prev => ({ ...prev, revenue: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cost">Total Costs (R)</Label>
                  <Input
                    id="cost"
                    type="number"
                    placeholder="75000"
                    value={marginValues.cost}
                    onChange={(e) => setMarginValues(prev => ({ ...prev, cost: e.target.value }))}
                  />
                </div>
              </div>
              <Button onClick={calculateMargin} className="w-full">
                Calculate Margin
              </Button>
              {marginValues.result !== 0 && (
                <div className={`p-4 rounded-lg ${marginValues.result > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="text-lg font-semibold">
                    Profit Margin: {marginValues.result.toFixed(2)}%
                  </p>
                  <p className="text-sm text-gray-600">
                    Profit: R{(parseFloat(marginValues.revenue) - parseFloat(marginValues.cost)).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="depreciation">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Depreciation Calculator
              </CardTitle>
              <CardDescription>
                Calculate asset depreciation using straight-line method.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-8">
                <p className="text-gray-500">Coming Soon - Depreciation calculator will be implemented here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};