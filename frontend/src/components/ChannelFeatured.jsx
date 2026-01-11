import React from 'react';

const ChannelFeatured = ({ channel }) => {
  if (!channel) return null;

  return (
    <div className="mb-8">
      <div className="flex items-start gap-6">
        {/* Channel Logo Card */}
        <div className="w-52 h-72 bg-gradient-to-br from-[#0056A8] to-[#003d7a] rounded-xl flex items-center justify-center shadow-2xl">
          <img
            src={channel.logo}
            alt={channel.name}
            className="w-full h-full object-cover rounded-xl"
          />
        </div>

        {/* Channel Info */}
        <div className="flex-1 pt-4">
          <h2 className="text-5xl font-light text-white mb-2">{channel.name}</h2>
          <p className="text-xl text-gray-400 mb-6">{channel.number} • HD</p>
          <p className="text-lg text-gray-300 leading-relaxed">
            {channel.description}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChannelFeatured;
