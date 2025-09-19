import React from "react";
import {
  Users,
  Video,
  Pill,
  Activity,
  MapPin,
  Star,
  ArrowRight,
  Shield,
  Clock,
  Heart,
} from "lucide-react";
import type { CurrentView } from "../App";

interface LandingPageProps {
  onNavigate: (view: CurrentView) => void;
  onPublicNavigate: (page: string) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({
  onNavigate,
  onPublicNavigate,
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50 via-white to-blue-50">
      {/* Navigation */}
      <nav className="bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-500 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo + Name */}
            <div className="flex items-center space-x-2">
              <Heart className="h-8 w-8 text-white" />
              <span className="text-xl font-extrabold text-white tracking-tight">
                HealthConnect
              </span>
            </div>

            {/* Pill Buttons */}
            <div className="hidden md:flex space-x-4">
              {[
                { label: "About ", key: "about" },
                { label: "Services", key: "services" },
                { label: "Contact", key: "contact" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => onPublicNavigate(item.key)}
                  className="px-5 py-2 rounded-full font-medium text-cyan-800 bg-white/30 border border-white/50 shadow-sm hover:bg-white hover:text-cyan-700 transition-all duration-200"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-cyan-50 to-blue-100 py-24">
        {/* Decorative Blobs */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-cyan-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Text Section */}
            <div>
              <h1 className="text-4xl lg:text-6xl font-extrabold text-gray-900 mb-6 leading-tight">
                Healthcare That Reaches
                <span className="text-emerald-600 block drop-shadow-lg">
                  Every Village
                </span>
              </h1>
              <p className="text-lg lg:text-xl text-gray-700 mb-8 leading-relaxed max-w-xl">
                Bridging healthcare gaps in rural and semi-urban areas through
                digital kiosks and remote consultations. Expert medical care,
                now accessible to everyone.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <button
                  onClick={() => onNavigate("login-patient")}
                  className="bg-emerald-600 text-white px-8 py-4 rounded-2xl shadow-lg hover:bg-emerald-700 transition-all font-semibold text-lg flex items-center justify-center space-x-2 transform hover:-translate-y-1"
                >
                  <div>Start Consultation</div>
                  <ArrowRight className="h-8 w-11" />
                </button>
                <button
                  onClick={() => onPublicNavigate("services")}
                  className="border-2 border-emerald-600 text-emerald-600 px-8 py-4 rounded-2xl hover:bg-emerald-50 transition-all font-semibold text-lg transform hover:-translate-y-1"
                >
                  Learn More
                </button>
              </div>
            </div>

            {/* Portal Card Section */}
            <div className="bg-white/90 backdrop-blur-md p-8 rounded-3xl shadow-2xl border border-gray-100 hover:shadow-3xl transition-shadow duration-500">
              <h3 className="text-2xl font-bold text-black-900 mb-6">
                Access Healthcare Portal
              </h3>
              <div className="space-y-4">
                <button
                  onClick={() => onNavigate("login-patient")}
                  className="w-full bg-blue-600 text-white p-4 rounded-2xl hover:bg-blue-700 shadow-md transition-all flex items-center space-x-3 transform hover:-translate-y-1"
                >
                  <Users className="h-6 w-6" />
                  <span className="font-semibold">Patient Portal</span>
                </button>

                <button
                  onClick={() => onNavigate("login-doctor")}
                  className="w-full bg-emerald-600 text-white p-4 rounded-2xl hover:bg-emerald-700 shadow-md transition-all flex items-center space-x-3 transform hover:-translate-y-1"
                >
                  <Activity className="h-6 w-6" />
                  <span className="font-semibold">Doctor Portal</span>
                </button>

                <button
                  onClick={() => onNavigate("login-pharmacy")}
                  className="w-full bg-yellow-600 text-white p-4 rounded-2xl hover:bg-yellow-700 shadow-md transition-all flex items-center space-x-3 transform hover:-translate-y-1"
                >
                  <Pill className="h-6 w-6" />
                  <span className="font-semibold">Pharmacy Portal</span>
                </button>

                <button
                  onClick={() => onNavigate("login-admin")}
                  className="w-full bg-red-600 text-white p-4 rounded-2xl hover:bg-red-700 shadow-md transition-all flex items-center space-x-3 transform hover:-translate-y-1"
                >
                  <Shield className="h-6 w-6" />
                  <span className="font-semibold">Admin Portal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Revolutionary Healthcare Solutions
            </h2>
            <p className="text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto">
              Our comprehensive platform combines physical kiosks with digital
              innovation to deliver world-class healthcare to underserved
              communities.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-emerald-50 p-8 rounded-xl hover:shadow-xl transition-all border border-emerald-100">
              <div className="bg-emerald-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                <MapPin className="h-8 w-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Physical Kiosk Access
              </h3>
              <p className="text-gray-600 leading-relaxed">
                State-of-the-art kiosks in rural areas equipped with biomedical
                sensors and high-quality video conferencing.
              </p>
            </div>

            <div className="bg-blue-50 p-8 rounded-xl hover:shadow-xl transition-all border border-blue-100">
              <div className="bg-blue-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                <Video className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Remote Consultation
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Connect with qualified doctors through secure video calls with
                real-time health monitoring.
              </p>
            </div>

            <div className="bg-purple-50 p-8 rounded-xl hover:shadow-xl transition-all border border-purple-100">
              <div className="bg-purple-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                <Pill className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Digital Prescriptions
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Instant digital prescriptions delivered to partnered pharmacies
                for quick medication fulfillment.
              </p>
            </div>

            <div className="bg-orange-50 p-8 rounded-xl hover:shadow-xl transition-all border border-orange-100">
              <div className="bg-orange-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                <Shield className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Pharmacy Integration
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Seamless integration with local pharmacies for prescription
                management and inventory tracking.
              </p>
            </div>

            <div className="bg-green-50 p-8 rounded-xl hover:shadow-xl transition-all border border-green-100">
              <div className="bg-green-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                <Activity className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Health Monitoring
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Continuous health tracking with biomedical sensors and
                comprehensive health record management.
              </p>
            </div>

            <div className="bg-red-50 p-8 rounded-xl hover:shadow-xl transition-all border border-red-100">
              <div className="bg-red-100 w-16 h-16 rounded-xl flex items-center justify-center mb-6">
                <Clock className="h-8 w-8 text-red-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                24/7 Availability
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Round-the-clock healthcare access with emergency consultation
                services and instant support.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Simple 3-Step Process
            </h2>
            <p className="text-lg lg:text-xl text-gray-600">
              Getting healthcare has never been this easy
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            <div className="text-center bg-white p-8 rounded-xl shadow hover:shadow-lg transition-all bg-yellow-50" >
              <div className="bg-emerald-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md">
                <span className="text-2xl font-bold text-white">1</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Register & Login
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Create your account and access the appropriate portal for your
                role.
              </p>
            </div>

            <div className="text-center bg-white p-8 rounded-xl shadow hover:shadow-lg transition-all bg-yellow-50">
              <div className="bg-blue-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md">
                <span className="text-2xl font-bold text-white">2</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Connect & Consult
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Join video consultation with qualified doctors and share your
                health data.
              </p>
            </div>

            <div className="text-center bg-white p-8 rounded-xl shadow hover:shadow-lg transition-all bg-yellow-50">
              <div className="bg-purple-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md">
                <span className="text-2xl font-bold text-white">3</span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Get Treatment
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Receive digital prescriptions and pick up medications from
                partner pharmacies.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">
              Transforming Lives Across Communities
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-8 rounded-xl shadow hover:shadow-md transition-all bg-green-100">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-600 mb-6 leading-relaxed">
                "The kiosk in our village has been a blessing. I can now consult
                with doctors without traveling 50km to the city."
              </p>
              <div className="font-semibold text-gray-900">Dua Lupa</div>
              <div className="text-gray-500">Patient, Rural Maharashtra</div>
            </div>

            <div className="bg-gray-50 p-8 rounded-xl shadow hover:shadow-md transition-all bg-green-100">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-600 mb-6 leading-relaxed">
                "As a doctor, this platform allows me to reach patients who need
                care the most. The technology is impressive."
              </p>
              <div className="font-semibold text-gray-900">Dr. Rajesh Singhla</div>
              <div className="text-gray-500">HR Dwa-Dua Consultancy</div>
            </div>

            <div className="bg-gray-50 p-8 rounded-xl shadow hover:shadow-md transition-all bg-green-100">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-600 mb-6 leading-relaxed">
                "Digital prescriptions have streamlined our operations. We can
                serve more patients efficiently."
              </p>
              <div className="font-semibold text-gray-900">Phill Salt</div>
              <div className="text-gray-500">RCB Pharmacy Owner</div>
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-8 mt-16 text-center">
            <div>
              <div className="text-4xl font-bold text-emerald-600 mb-2">
                28000+
              </div>
              <div className="text-gray-600">Consultations Completed</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-blue-600 mb-2">300+</div>
              <div className="text-gray-600">Villages Served</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-purple-600 mb-2">130+</div>
              <div className="text-gray-600">Partner Pharmacies</div>
            </div>
            <div>
              <div className="text-4xl font-bold text-orange-600 mb-2">86%</div>
              <div className="text-gray-600">Patient Satisfaction</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Heart className="h-6 w-6 text-emerald-400" />
                <span className="font-bold text-xl">HealthConnect</span>
              </div>
              <p className="text-gray-400 leading-relaxed">
                Bringing healthcare to every corner of India through digital
                innovation and human connection.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-lg mb-4">Quick Links</h4>
              <ul className="space-y-2">
                {["About", "Services", "Contact"].map((item) => (
                  <li key={item}>
                    <button
                      onClick={() => onPublicNavigate(item.toLowerCase())}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-lg mb-4">Portals</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => onNavigate("login-patient")}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Patient Portal
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate("login-doctor")}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Doctor Portal
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate("login-pharmacy")}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Pharmacy Portal
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate("login-admin")}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    Admin Portal
                  </button>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-lg mb-4">Contact</h4>
              <p className="text-gray-400">support@healthconnect.com</p>
              <p className="text-gray-400">+91 8127136711</p>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-500 text-sm">
            © 2024 HealthConnect. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
