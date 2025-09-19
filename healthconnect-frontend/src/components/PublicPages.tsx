import React from 'react';
import { ArrowLeft, Heart, Users, Activity, Pill, MapPin, Phone, Mail, Globe, CheckCircle, Award, Clock } from 'lucide-react';
import type { CurrentView } from '../App';

interface PublicPagesProps {
  page: string;
  onNavigate: (view: CurrentView) => void;
  onPublicNavigate: (page: string) => void;
}

const PublicPages: React.FC<PublicPagesProps> = ({ page, onNavigate, onPublicNavigate }) => {
  const renderAbout = () => (
    <div className="space-y-16">
      {/* Mission Section */}
<section className="text-center bg-gradient-to-r from-sky-50 via-white to-emerald-50 py-16 px-6 rounded-3xl shadow-xl 
  transition-transform duration-500 hover:scale-[1.02] hover:shadow-2xl bg-green-100">
  
  <h1 className="text-3xl lg:text-5xl font-bold bg-gradient-to-r from-emerald-600 via-sky-600 to-blue-600 
    bg-clip-text text-transparent mb-6 transition-all duration-500 
    hover:from-blue-600 hover:via-emerald-600 hover:to-sky-600 hover:tracking-wide">
    Transforming Rural Healthcare
  </h1>

  <p className="text-xl text-gray-700 max-w-4xl mx-auto leading-relaxed transition-colors duration-300 
    hover:text-gray-900">
    <span className="text-emerald-700 font-semibold hover:text-emerald-800">HealthConnect</span> bridges the 
    healthcare gap in rural and semi-urban India through 
    <span className="text-sky-600 font-medium hover:text-blue-600"> innovative digital solutions</span>, making 
    quality medical care accessible to every community, regardless of location.
  </p>
</section>


     {/* Values Section */}
<section className="py-16 px-6 bg-gradient-to-r from-sky-50 via-white to-emerald-50 rounded-3xl shadow-inner">
  <div className="text-center mb-16">
    <h2 className="text-4xl font-extrabold bg-gradient-to-r from-gray-600 via-gray-600 to-gray-600 
      bg-clip-text text-transparent tracking-tight">
      Our Core Values
    </h2>
  </div>

  <div className="grid md:grid-cols-3 gap-10">
    {/* Compassionate Care */}
    <div className="bg-gradient-to-br from-emerald-100 via-green-50 to-white p-8 rounded-2xl shadow-md 
      hover:shadow-2xl transition-transform duration-500 hover:scale-105 text-center">
      <div className="bg-gradient-to-tr from-emerald-400 to-green-600 w-20 h-20 rounded-full flex items-center 
        justify-center mx-auto mb-6 shadow-lg">
        <Heart className="h-10 w-10 text-white" />
      </div>
      <h3 className="text-2xl font-bold text-emerald-700 mb-4">Compassionate Care</h3>
      <p className="text-gray-700 leading-relaxed">
        Every patient receives <span className="text-emerald-600 font-semibold">personalized, empathetic healthcare</span> 
        regardless of their location or economic status.
      </p>
    </div>

    {/* Universal Access */}
    <div className="bg-gradient-to-br from-sky-100 via-blue-50 to-white p-8 rounded-2xl shadow-md 
      hover:shadow-2xl transition-transform duration-500 hover:scale-105 text-center">
      <div className="bg-gradient-to-tr from-sky-500 to-blue-700 w-20 h-20 rounded-full flex items-center 
        justify-center mx-auto mb-6 shadow-lg">
        <Globe className="h-10 w-10 text-white" />
      </div>
      <h3 className="text-2xl font-bold text-sky-700 mb-4">Universal Access</h3>
      <p className="text-gray-700 leading-relaxed">
        Breaking down <span className="text-blue-600 font-semibold">geographical barriers</span> to ensure healthcare 
        reaches underserved communities everywhere.
      </p>
    </div>

    {/* Excellence */}
    <div className="bg-gradient-to-br from-purple-100 via-indigo-50 to-white p-8 rounded-2xl shadow-md 
      hover:shadow-2xl transition-transform duration-500 hover:scale-105 text-center">
      <div className="bg-gradient-to-tr from-purple-500 to-indigo-700 w-20 h-20 rounded-full flex items-center 
        justify-center mx-auto mb-6 shadow-lg">
        <Award className="h-10 w-10 text-white" />
      </div>
      <h3 className="text-2xl font-bold text-purple-700 mb-4">Excellence</h3>
      <p className="text-gray-700 leading-relaxed">
        Maintaining the <span className="text-purple-600 font-semibold">highest standards</span> of medical care 
        through innovation and technology.
      </p>
    </div>
  </div>
</section>


      {/* Team Section */}
<section>
  <div className="text-center mb-12">
    <h2 className="text-3xl font-bold text-gray-900 mb-4">Our Leadership Team</h2>
    <p className="text-xl text-gray-600">
      Experienced professionals dedicated to revolutionizing healthcare delivery
    </p>
  </div>
  <div className="grid md:grid-cols-3 gap-10">
    {[
      {
        name: 'Dr Pradeep Awasthi',
        role: 'SDE- MedTech',
        experience: '15+ years Experience',
        education: 'NITJ- ICE',
        image: '/team/pradeep.jpg', // 👈 place image in public/team/
      },
      {
        name: 'Dr Paarth Lalit',
        role: 'Officer- HPCL',
        experience: '12+ years Experience',
        education: 'NITJ-ICE',
        image: '/team/paarth.jpg',
      },
      {
        name: 'Vishal Chhokra',
        role: 'Officer-BHEL',
        experience: '10+ years in healthcare management',
        education: 'NITJ-CSE',
        image: '/team/vishal.jpg',
      },
    ].map((member, index) => (
      <div
        key={index}
        className="bg-white p-6 rounded-xl shadow-md text-center hover:shadow-lg transition duration-300"
      >
        {/* Image */}
        <div className="w-28 h-28 mx-auto mb-4 rounded-full overflow-hidden border-4 border-emerald-100 shadow">
          <img
            src={member.image}
            alt={member.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Details */}
        <h3 className="text-xl font-bold text-gray-900">{member.name}</h3>
        <p className="text-emerald-600 font-semibold mb-2">{member.role}</p>
        <p className="text-gray-600 text-sm mb-1">{member.experience}</p>
        <p className="text-gray-500 text-sm">{member.education}</p>
      </div>
    ))}
  </div>
</section>


      {/* Partners Section */}
      <section className="bg-gray-50 rounded-4xl p-100">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Our Partners</h2>
          <p className="text-xl text-gray-600">
            Collaborating with leading healthcare institutions and technology partners
          </p>
        </div>
        <div className="grid md:grid-cols-4 gap-8">
          {[
            'AIIMS Network',
            'Apollo Hospitals',
            'TataMG Consultancy',
            'Microsoft Healthcare'
          ].map((partner, index) => (
            <div key={index} className="bg-white p-6 rounded-lg shadow-sm text-center">
              <div className="h-16 w-16 bg-gray-200 rounded mx-auto mb-4"></div>
              <p className="font-semibold text-gray-900">{partner}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderServices = () => (
    <div className="space-y-16">
      <section className="text-center">
        <h1 className="text-3xl lg:text-3xl font-bold text-gray-900 mb-6">
          Comprehensive Healthcare Services
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          From emergency consultations to preventive care, we offer a complete range of medical services 
          designed for rural and semi-urban communities.
        </p>
      </section>
{/* Primary Services */}
<section className="py-5 bg-gradient-to-b from-emerald-50 via-white to-emerald-50">
  <h2 className="text-2xl font-bold text-emerald-800 text-center mb-12">
    Primary Services
  </h2>
  
  <div className="grid lg:grid-cols-2 gap-10">
    {[
      {
        icon: <Activity className="h-8 w-8 text-blue-600" />,
        iconBg: "bg-blue-200",
        title: "Video Consultations",
        text: "Connect with qualified doctors through high-quality video calls with real-time health monitoring and digital prescription services.",
        points: [
          "24/7 availability",
          "Multi-specialty consultations",
          "Real-time vital monitoring",
        ],
      },
      {
        icon: <MapPin className="h-8 w-8 text-emerald-700" />,
        iconBg: "bg-blue-200",
        title: "Physical Kiosks",
        text: "State-of-the-art healthcare kiosks equipped with advanced biomedical sensors and telemedicine capabilities deployed in rural areas.",
        points: [
          "Advanced diagnostic equipment",
          "Multilingual interface",
          "Privacy-protected consultations",
        ],
      },
      {
        icon: <Pill className="h-8 w-8 text-purple-700" />,
        iconBg: "bg-blue-200",
        title: "Digital Prescriptions",
        text: "Seamless digital prescription system integrated with local pharmacies for quick medication dispensing and inventory management.",
        points: [
          "Instant prescription delivery",
          "Pharmacy network integration",
          "Medication tracking",
        ],
      },
      {
        icon: <Heart className="h-8 w-8 text-orange-700" />,
        iconBg: "bg-blue-200",
        title: "Health Monitoring",
        text: "Continuous health tracking with biomedical sensors and comprehensive health record management for preventive care.",
        points: [
          "Vital signs monitoring",
          "Health record digitization",
          "Preventive care alerts",
        ],
      },
    ].map((service, idx) => (
      <div
        key={idx}
        className="bg-blue-50 p-8 rounded-2xl shadow-md transition-transform transform hover:-translate-y-2 hover:shadow-2xl hover:bg-blue-100"
      >
        <div
          className={`${service.iconBg} w-16 h-16 rounded-xl flex items-center justify-center mb-6 mx-auto shadow-md`}
        >
          {service.icon}
        </div>
        <h3 className="text-2xl font-bold text-blue-900 mb-4 text-center">
          {service.title}
        </h3>
        <p className="text-blue-700 mb-6 text-center">{service.text}</p>
        <ul className="space-y-2">
          {service.points.map((point, i) => (
            <li key={i} className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-blue-600" />
              <span className="text-blue-800">{point}</span>
            </li>
          ))}
        </ul>
      </div>
    ))}
  </div>
</section>



    {/* Specialties */}
<section className="bg-gradient-to-br from-emerald-50 via-white to-emerald-50 rounded-2xl p- shadow-lg">
  <h2 className="text-4xl font-extrabold text-center text-emerald-800 mb-12 tracking-tight">
    Medical Specialties
  </h2>
  
  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
    {[
      'General Medicine',
      'Pediatrics',
      'Gynecology',
      'Cardiology',
      'Dermatology',
      'Orthopedics',
      'Psychiatry',
      'Diabetes Care',
      'Emergency Medicine'
    ].map((specialty, index) => (
      <div
        key={index}
        className="bg-white p-6 rounded-xl shadow-md text-center font-bold text-gray-900 
                   transition-transform transform hover:-translate-y-2 hover:shadow-2xl 
                   hover:bg-gradient-to-r hover:from-emerald-100 hover:to-emerald-50"
      >
        <p className="text-lg text-emerald-900 tracking-wide">{specialty}</p>
      </div>
    ))}
  </div>
</section>


      {/* Process */}
      <section>
        <h2 className="text-3xl font-bold text-gray-900 mb-8">How It Works</h2>
        <div className="grid md:grid-cols-4 gap-8">
          {[
            {
              step: 1,
              title: 'Register',
              description: 'Create your account and complete profile setup',
              icon: Users
            },
            {
              step: 2,
              title: 'Book Consultation',
              description: 'Schedule or start immediate consultation',
              icon: Clock
            },
            {
              step: 3,
              title: 'Connect with Doctor',
              description: 'Video consultation with qualified physician',
              icon: Activity
            },
            {
              step: 4,
              title: 'Get Treatment',
              description: 'Receive digital prescription and follow-up care',
              icon: Heart
            }
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={index} className="text-center">
                <div className="bg-emerald-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <div className="bg-emerald-100 w-8 h-8 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-emerald-800 font-bold">{item.step}</span>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );

  const renderContact = () => (
    <div className="space-y-16">
      <section className="text-center">
        <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">
          Get in Touch
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          We're here to help you access quality healthcare. Reach out to us for support, 
          partnerships, or any questions about our services.
        </p>
      </section>

      <div className="grid lg:grid-cols-2 gap-16">
        {/* Contact Form */}
        <div className="bg-white p-8 rounded-xl shadow-sm">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Send us a Message</h2>
          <form className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" 
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
              <input 
                type="email" 
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
              <input 
                type="tel" 
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
              <select className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
                <option>General Inquiry</option>
                <option>Technical Support</option>
                <option>Partnership Opportunity</option>
                <option>Media Inquiry</option>
                <option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
              <textarea 
                rows={6} 
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="Tell us how we can help you..."
              ></textarea>
            </div>
            <button 
              type="submit" 
              className="w-full bg-emerald-600 text-white py-3 px-6 rounded-lg hover:bg-emerald-700 transition-colors font-semibold"
            >
              Send Message
            </button>
          </form>
        </div>

        {/* Contact Information */}
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Contact Information</h2>
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="bg-emerald-100 w-12 h-12 rounded-lg flex items-center justify-center">
                  <Phone className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Phone Support</h3>
                  <p className="text-gray-600">1800-HEALTH-1 (1800-432-5841)</p>
                  <p className="text-sm text-gray-500">24/7 Emergency Support Available</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center">
                  <Mail className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Email Support</h3>
                  <p className="text-gray-600">support@healthconnect.in</p>
                  <p className="text-sm text-gray-500">Response within 24 hours</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center">
                  <MapPin className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Headquarters</h3>
                  <p className="text-gray-600">
                    HealthConnect Technologies Pvt. Ltd.<br />
                    Koramangala, Bangalore 560034<br />
                    Karnataka, India
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Office Hours */}
          <div className="bg-gray-50 p-6 rounded-xl">
            <h3 className="font-bold text-gray-900 mb-4">Office Hours</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Monday - Friday</span>
                <span className="text-gray-900">9:00 AM - 6:00 PM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Saturday</span>
                <span className="text-gray-900">9:00 AM - 2:00 PM</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sunday</span>
                <span className="text-gray-900">Emergency Only</span>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="bg-red-50 border border-red-200 p-6 rounded-xl">
            <h3 className="font-bold text-red-800 mb-2">Medical Emergency</h3>
            <p className="text-red-700 text-sm mb-4">
              For immediate medical assistance or life-threatening emergencies:
            </p>
            <p className="text-2xl font-bold text-red-600">102 or 108</p>
            <p className="text-sm text-red-600">National Emergency Numbers</p>
          </div>
        </div>
      </div>

      {/* Kiosk Locations Map */}
      <section className="bg-white rounded-xl shadow-sm p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">HealthConnect Kiosk Locations</h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Maharashtra</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Pune Rural Districts (45 kiosks)</p>
              <p>• Nashik Region (32 kiosks)</p>
              <p>• Aurangabad Area (28 kiosks)</p>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Karnataka</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Mysore Districts (38 kiosks)</p>
              <p>• Hubli-Dharwad (25 kiosks)</p>
              <p>• Belgaum Region (22 kiosks)</p>
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-4">Rajasthan</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Udaipur Rural (35 kiosks)</p>
              <p>• Jodhpur Area (29 kiosks)</p>
              <p>• Bikaner Region (18 kiosks)</p>
            </div>
          </div>
        </div>
        <div className="mt-8 p-6 bg-emerald-50 rounded-lg">
          <p className="text-emerald-800 font-semibold">Expanding Soon:</p>
          <p className="text-emerald-700 text-sm mt-2">
            We're actively deploying kiosks in Uttar Pradesh, Madhya Pradesh, and Bihar. 
            Contact us if you'd like to bring HealthConnect to your community.
          </p>
        </div>
      </section>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => onNavigate('landing')}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back to Home</span>
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <Heart className="h-8 w-8 text-emerald-600" />
              <span className="text-xl font-bold text-gray-900">HealthConnect</span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {[
              { key: 'about', label: 'About Us' },
              { key: 'services', label: 'Services' },
              { key: 'contact', label: 'Contact' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => onPublicNavigate(tab.key)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  page === tab.key
                    ? 'border-emerald-500 text-emerald-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {page === 'about' && renderAbout()}
        {page === 'services' && renderServices()}
        {page === 'contact' && renderContact()}
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Heart className="h-8 w-8 text-emerald-400" />
              <span className="text-xl font-bold">HealthConnect</span>
            </div>
            <p className="text-gray-400 mb-6">
              Revolutionizing healthcare access in rural communities
            </p>
            <div className="flex justify-center space-x-8">
              <button 
                onClick={() => onPublicNavigate('about')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                About
              </button>
              <button 
                onClick={() => onPublicNavigate('services')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Services
              </button>
              <button 
                onClick={() => onPublicNavigate('contact')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                Contact
              </button>
            </div>
            <div className="border-t border-gray-800 mt-8 pt-8">
              <p className="text-gray-400">&copy; 2025 HealthConnect. All rights reserved.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicPages;