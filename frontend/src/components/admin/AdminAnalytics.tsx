import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Users, 
  CreditCard, 
  FileText, 
  TrendingUp,
  Activity,
  DollarSign,
  Download,
  Eye
} from 'lucide-react';

export const AdminAnalytics: React.FC = () => {
  const stats = [
    {
      title: 'Total Users',
      value: '1,234',
      change: '+20% from last month',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      title: 'Active Subscriptions',
      value: '856',
      change: '+15% from last month',
      icon: CreditCard,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      title: 'Template Downloads',
      value: '2,451',
      change: '+8% from last week',
      icon: Download,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      title: 'Monthly Revenue',
      value: 'R245,000',
      change: '+25% from last month',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    }
  ];

  const recentActivity = [
    {
      user: 'John Smith',
      action: 'Subscribed to DIY + Accountant plan',
      time: '2 hours ago',
      amount: 'R2,000'
    },
    {
      user: 'Sarah Johnson',
      action: 'Downloaded Financial Dashboard template',
      time: '4 hours ago',
      amount: null
    },
    {
      user: 'Mike Chen',
      action: 'Used CRM System application',
      time: '6 hours ago',
      amount: null
    },
    {
      user: 'Lisa Brown',
      action: 'Upgraded to DIY + Accountant',
      time: '1 day ago',
      amount: 'R2,000'
    }
  ];

  const popularProducts = [
    { name: 'CRM System', category: 'Sales & Marketing', usage: 245, type: 'Application' },
    { name: 'Financial Dashboard', category: 'Accounting & Finance', usage: 189, type: 'Template' },
    { name: 'Payroll Calculator', category: 'Calculators', usage: 156, type: 'Application' },
    { name: 'Business Plan Template', category: 'General', usage: 134, type: 'Template' },
    { name: 'Invoice Generator', category: 'Accounting & Finance', usage: 98, type: 'Application' }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-muted-foreground">
          Platform performance and usage statistics
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.change}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest user actions and system events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{activity.user}</p>
                    <p className="text-xs text-muted-foreground">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                  {activity.amount && (
                    <Badge variant="outline" className="text-green-600">
                      {activity.amount}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Popular Products */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Popular Products
            </CardTitle>
            <CardDescription>
              Most used applications and templates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {popularProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{product.name}</p>
                      <Badge variant={product.type === 'Application' ? 'default' : 'secondary'} className="text-xs">
                        {product.type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{product.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Eye className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm font-medium">{product.usage}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Usage Charts Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Trends</CardTitle>
          <CardDescription>
            User activity and engagement over time
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
            <div className="text-center">
              <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Chart visualization would be implemented here
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Consider integrating with Chart.js or Recharts
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};