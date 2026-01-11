import React from 'react';

const ChannelFeatured = ({ channel }) => {
  if (!channel) return null;

  return (
    <div className="mb-6">
      <div className="flex items-start gap-4">
        {/* Channel Logo Card */}
        <div className="w-40 h-56 bg-gradient-to-br from-[#0056A8] to-[#003d7a] rounded-lg flex items-center justify-center shadow-xl">
          <img
            src={channel.logo_path || channel.logo}
            alt={channel.name}
            className="w-full h-full object-cover rounded-lg"
          />
        </div>

        {/* Channel Info */}
        <div className="flex-1 pt-2">
          <h2 className="text-4xl font-light text-white mb-1">{channel.name}</h2>
          <p className="text-lg text-gray-400 mb-4">{channel.number} • HD</p>
          <p className="text-base text-gray-300 leading-relaxed">
            {channel.description}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChannelFeatured;
