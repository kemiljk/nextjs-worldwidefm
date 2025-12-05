'use client';

import { useState } from 'react';
import { Mail, Phone, MapPin, MessageCircle, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlausible } from 'next-plausible';

interface ContactFormProps {
  contactInfo: {
    metadata: {
      email?: string;
      phone?: string;
      location?: string;
    };
  };
}

export default function ContactForm({ contactInfo }: ContactFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState('');
  const plausible = usePlausible();

  const { email, phone, location } = contactInfo.metadata || {};

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        plausible('Contact Form Submitted', {
          props: {
            subject: formData.subject,
          },
        });
        setSubmitStatus('success');
        setSubmitMessage("Message sent successfully! We'll get back to you soon.");
        setFormData({ name: '', email: '', subject: '', message: '' });
      } else {
        plausible('Contact Form Error', {
          props: {
            error: result.error || 'Unknown error',
          },
        });
        setSubmitStatus('error');
        setSubmitMessage(result.error || 'Failed to send message. Please try again.');
      }
    } catch (error) {
      plausible('Contact Form Error', {
        props: {
          error: 'Network error',
        },
      });
      setSubmitStatus('error');
      setSubmitMessage('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='max-w-4xl mx-auto py-8'>
      <div className='mb-12 text-center'>
        <h1 className='text-4xl font-display font-bold mb-4'>Contact Us</h1>
        <p className='text-lg text-muted-foreground max-w-2xl mx-auto'>
          Get in touch with the Worldwide FM team. We'd love to hear from you about partnerships,
          collaborations, or any questions you might have.
        </p>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-8 mb-12'>
        {/* Contact Information */}
        <div className='space-y-6'>
          <h2 className='text-2xl font-display font-bold mb-6'>Get In Touch</h2>

          <div className='space-y-4'>
            {email && (
              <div className='flex items-center space-x-3'>
                <div className='shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center'>
                  <Mail className='h-5 w-5 text-primary' />
                </div>
                <div>
                  <p className='font-medium'>Email</p>
                  <a
                    href={`mailto:${email}`}
                    className='text-primary hover:underline transition-colors'
                  >
                    {email}
                  </a>
                </div>
              </div>
            )}

            {phone && (
              <div className='flex items-center space-x-3'>
                <div className='shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center'>
                  <Phone className='h-5 w-5 text-primary' />
                </div>
                <div>
                  <p className='font-medium'>Phone</p>
                  <a
                    href={`tel:${phone.replace(/\s/g, '')}`}
                    className='text-primary hover:underline transition-colors'
                  >
                    {phone}
                  </a>
                </div>
              </div>
            )}

            {location && (
              <div className='flex items-center space-x-3'>
                <div className='shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center'>
                  <MapPin className='h-5 w-5 text-primary' />
                </div>
                <div>
                  <p className='font-medium'>Location</p>
                  <p className='text-muted-foreground'>{location}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contact Form */}
        <div className='space-y-6'>
          <h2 className='text-2xl font-display font-bold mb-6'>Send a Message</h2>

          {/* Status Messages */}
          {submitStatus === 'success' && (
            <div className='flex items-center space-x-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 '>
              <CheckCircle className='h-5 w-5 text-green-600 dark:text-green-400' />
              <p className='text-green-800 dark:text-green-200'>{submitMessage}</p>
            </div>
          )}

          {submitStatus === 'error' && (
            <div className='flex items-center space-x-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 '>
              <AlertCircle className='h-5 w-5 text-red-600 dark:text-red-400' />
              <p className='text-red-800 dark:text-red-200'>{submitMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className='space-y-4'>
            <div>
              <label htmlFor='name' className='block text-sm font-medium mb-2'>
                Name
              </label>
              <input
                type='text'
                id='name'
                name='name'
                value={formData.name}
                onChange={handleInputChange}
                className='w-full px-3 py-2 border border-gray-300  focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white'
                placeholder='Your name'
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor='email' className='block text-sm font-medium mb-2'>
                Email
              </label>
              <input
                type='email'
                id='email'
                name='email'
                value={formData.email}
                onChange={handleInputChange}
                className='w-full px-3 py-2 border border-gray-300  focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white'
                placeholder='your.email@example.com'
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor='subject' className='block text-sm font-medium mb-2'>
                Subject
              </label>
              <input
                type='text'
                id='subject'
                name='subject'
                value={formData.subject}
                onChange={handleInputChange}
                className='w-full px-3 py-2 border border-gray-300  focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white'
                placeholder="What's this about?"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor='message' className='block text-sm font-medium mb-2'>
                Message
              </label>
              <textarea
                id='message'
                name='message'
                value={formData.message}
                onChange={handleInputChange}
                rows={4}
                className='w-full px-3 py-2 border border-gray-300  focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-white'
                placeholder='Tell us more...'
                required
                disabled={isSubmitting}
              ></textarea>
            </div>

            <Button type='submit' className='w-full' disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2'></div>
                  Sending...
                </>
              ) : (
                <>
                  <MessageCircle className='h-4 w-4 mr-2' />
                  Send Message
                </>
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Additional Information */}
      <div className='border border-almostblack dark:border-white p-6'>
        <h3 className='text-xl font-display font-bold mb-4'>Additional Ways to Connect</h3>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground'>
          <div>
            <p className='font-medium text-foreground mb-2'>Partnerships</p>
            <p>
              Interested in collaborating with Worldwide FM? We're always open to new partnerships
              and opportunities.
            </p>
          </div>
          <div>
            <p className='font-medium text-foreground mb-2'>Press & Media</p>
            <p>For press inquiries, interviews, or media requests, please reach out to our team.</p>
          </div>
          <div>
            <p className='font-medium text-foreground mb-2'>General Support</p>
            <p>Have a question about our shows, events, or services? We're here to help.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
