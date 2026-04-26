import React, {useState, useEffect} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSnapshot } from 'valtio';
import config from '../config/config';
import state from '../store';
// import {download} from '../assets';
import {downloadCanvasToImage, reader} from '../config/helpers';
import {EditorTabs, FilterTabs, DecalTypes} from '../config/constants';
import { fadeAnimation, slideAnimation } from '../config/motion';
import { AIpicker, Colorpicker, CustomButton, Filepicker, Tab } from '../components';

const Customizer = () => {
  const snap = useSnapshot(state);
  const [file, setFile] = useState('')
  const [prompt, setPrompt] = useState('')
  const [generatingImg, setGeneratingImg] = useState(false)
  const [activeEditorTab, setActiveEditorTab] = useState("")
  const [activeFilterTab, setActiveFilterTab] = useState({
    logoShirt : true,
    stylishShirt : false,
  })

  const generateTabContent = () => {
    switch(activeEditorTab) {
      case "colorpicker" :
        return <Colorpicker onClose={() => setActiveEditorTab('')} />
      case "filepicker" :
        return <Filepicker onClose={() => setActiveEditorTab('')} />
      case "aipicker" :
        return <AIpicker onClose={() => setActiveEditorTab('')}/>
      default:
        return null
    }
  }

  return (
    <AnimatePresence>
      {!snap.intro && (
        <>
          <motion.div 
            key="custom"
            className="absolute top-0 left-0 z-10"
            {...slideAnimation('left')}
          >
            <div className="flex items-center min-h-screen">
              <div className="editortabs-container tabs">
                {EditorTabs.map((tab) => (
                  <Tab 
                    key={tab.name}
                    tab={tab}
                    handleClick={() => setActiveEditorTab(tab.name)}
                  />
                ))}
                
              </div>
              {generateTabContent()}
            </div>
          </motion.div>
          <motion.div 
            className="absolute z-30 top-4 right-4 md:right-5"
            {...fadeAnimation}
          >
            <CustomButton 
              type="filled"
              title="Go Back"
              handleClick={() => state.intro = true}
              customStyles="w-fit px-3 py-2 text-xs md:text-sm"
            />
          </motion.div>
          <motion.div
            className="filtertabs-container"
            {...slideAnimation('up')}
          >
            {FilterTabs.map((tab) => (
              <Tab 
                key={tab.name}
                tab={tab}
                isFilterTab
                ifActiveTab=""
                handleClick={() => {}}
              />
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default Customizer