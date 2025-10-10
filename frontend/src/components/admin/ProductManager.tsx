import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, ExternalLink } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  type: 'application' | 'template';
  urlExtension?: string;
  fileType?: 'word' | 'excel' | 'powerpoint' | 'pdf';
  fileUrl?: string;
  icon: string;
}

export const ProductManager: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([
    {
      id: '1',
      name: 'CRM System',
      description: 'Manage your customer relationships and sales pipeline',
      category: 'Sales & Marketing',
      type: 'application',
      urlExtension: 'crm',
      icon: '👥',
    },
    {
      id: '2',
      name: 'Financial Dashboard',
      description: 'Excel dashboard for tracking business finances',
      category: 'Accounting & Finance',
      type: 'template',
      fileType: 'excel',
      fileUrl: '/templates/financial-dashboard.xlsx',
      icon: '📊',
    },
  ]);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const categories = [
    'Accounting & Finance',
    'Human Resources', 
    'Sales & Marketing',
    'Inventory Management',
    'Project Management',
    'Calculators',
    'General'
  ];

  const fileTypes = ['word', 'excel', 'powerpoint', 'pdf'];

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    type: 'application' as 'application' | 'template',
    urlExtension: '',
    fileType: '' as 'word' | 'excel' | 'powerpoint' | 'pdf' | '',
    fileUrl: '',
    icon: '',
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      type: 'application',
      urlExtension: '',
      fileType: '',
      fileUrl: '',
      icon: '',
    });
  };

  const handleAdd = () => {
    if (!formData.name || !formData.description || !formData.category) return;

    const newProduct: Product = {
      id: Date.now().toString(),
      name: formData.name,
      description: formData.description,
      category: formData.category,
      type: formData.type,
      icon: formData.icon || (formData.type === 'application' ? '🔧' : '📄'),
      ...(formData.type === 'application' && { urlExtension: formData.urlExtension }),
      ...(formData.type === 'template' && { 
        fileType: formData.fileType,
        fileUrl: formData.fileUrl 
      }),
    };

    setProducts([...products, newProduct]);
    setIsAddDialogOpen(false);
    resetForm();
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      category: product.category,
      type: product.type,
      urlExtension: product.urlExtension || '',
      fileType: product.fileType || '',
      fileUrl: product.fileUrl || '',
      icon: product.icon,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingProduct || !formData.name || !formData.description || !formData.category) return;

    const updatedProduct: Product = {
      ...editingProduct,
      name: formData.name,
      description: formData.description,
      category: formData.category,
      type: formData.type,
      icon: formData.icon,
      ...(formData.type === 'application' && { urlExtension: formData.urlExtension }),
      ...(formData.type === 'template' && { 
        fileType: formData.fileType as 'word' | 'excel' | 'powerpoint' | 'pdf',
        fileUrl: formData.fileUrl 
      }),
    };

    setProducts(products.map(p => p.id === editingProduct.id ? updatedProduct : p));
    setIsEditDialogOpen(false);
    setEditingProduct(null);
    resetForm();
  };

  const handleDelete = (productId: string) => {
    setProducts(products.filter(p => p.id !== productId));
  };

  const ProductForm = ({ isEdit = false }: { isEdit?: boolean }) => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="name">Product Name *</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Enter product name"
        />
      </div>

      <div>
        <Label htmlFor="description">Description *</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Enter product description"
        />
      </div>

      <div>
        <Label htmlFor="category">Category *</Label>
        <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="type">Product Type *</Label>
        <Select 
          value={formData.type} 
          onValueChange={(value: 'application' | 'template') => 
            setFormData({ 
              ...formData, 
              type: value,
              urlExtension: value === 'template' ? '' : formData.urlExtension,
              fileType: value === 'application' ? '' : formData.fileType,
              fileUrl: value === 'application' ? '' : formData.fileUrl,
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="application">Application</SelectItem>
            <SelectItem value="template">Template</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {formData.type === 'application' && (
        <div>
          <Label htmlFor="urlExtension">URL Extension</Label>
          <Input
            id="urlExtension"
            value={formData.urlExtension}
            onChange={(e) => setFormData({ ...formData, urlExtension: e.target.value })}
            placeholder="e.g., crm, calculator-loan"
          />
        </div>
      )}

      {formData.type === 'template' && (
        <>
          <div>
            <Label htmlFor="fileType">File Type *</Label>
            <Select 
              value={formData.fileType} 
              onValueChange={(value: 'word' | 'excel' | 'powerpoint' | 'pdf') => 
                setFormData({ ...formData, fileType: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select file type" />
              </SelectTrigger>
              <SelectContent>
                {fileTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="fileUrl">File URL</Label>
            <Input
              id="fileUrl"
              value={formData.fileUrl}
              onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
              placeholder="/templates/filename.xlsx"
            />
          </div>
        </>
      )}

      <div>
        <Label htmlFor="icon">Icon (Emoji)</Label>
        <Input
          id="icon"
          value={formData.icon}
          onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
          placeholder="🔧"
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Management</h1>
          <p className="text-muted-foreground">
            Manage business tools, templates, and calculators
          </p>
        </div>

        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
              <DialogDescription>
                Create a new business tool, template, or calculator for your platform.
              </DialogDescription>
            </DialogHeader>
            <ProductForm />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAdd}>Add Product</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Card key={product.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">{product.icon}</div>
                  <div>
                    <CardTitle className="text-lg">{product.name}</CardTitle>
                    <Badge variant="outline" className="mt-1">
                      {product.category}
                    </Badge>
                  </div>
                </div>
                <Badge variant={product.type === 'application' ? 'default' : 'secondary'}>
                  {product.type}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">
                {product.description}
              </CardDescription>
              
              {product.type === 'application' && product.urlExtension && (
                <p className="text-xs text-muted-foreground mb-4">
                  URL: /app/{product.urlExtension}
                </p>
              )}

              {product.type === 'template' && (
                <div className="text-xs text-muted-foreground mb-4">
                  <p>Type: {product.fileType}</p>
                  {product.fileUrl && <p>File: {product.fileUrl}</p>}
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleEdit(product)}
                  className="flex-1"
                >
                  <Edit className="mr-2 h-3 w-3" />
                  Edit
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="flex-1">
                      <Trash2 className="mr-2 h-3 w-3" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Product</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{product.name}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(product.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
            <DialogDescription>
              Update the product information below.
            </DialogDescription>
          </DialogHeader>
          <ProductForm isEdit={true} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate}>Update Product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};