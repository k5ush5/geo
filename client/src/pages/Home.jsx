import {motion, AnimatePresence} from 'framer-motion';
import { useSnapshot } from 'valtio';
import state from '../store';
import {
    headContainerAnimation, 
    headContentAnimation,
    headTextAnimation,
    slideAnimation
} from '../config/motion';
import CustomButton from '../components/CustomButton';
const Home = () => {
  const snap = useSnapshot(state);
  return (
    <AnimatePresence>
        {snap.intro && (
            <motion.section className='home bg-white' {...slideAnimation('left')}>
                <motion.header {...slideAnimation("down")}>
                    <img 
                        src = '../public/threejs.png'
                        alt = "logo"
                        className='w-8 h-8 object-contain'
                    />
                </motion.header>
                <motion.div className='home-content' {...headContainerAnimation}>
                    <motion.div {...headTextAnimation}>
                        {/* <h1 className='head-text'>
                            НАЧ <br className='xl:block hidden'/> НИ.
                        </h1> */}
                    </motion.div>
                    <motion.div
                        {...headContentAnimation}
                        className='flex flex-col gap-5'
                    >
                        <p className='max-w-md font-normal text-gray-600 text-base'>
                            Пойми стереометрию с помощью <strong>визуализации</strong>{" "}.
                        </p>
                        <CustomButton 
                            type="filled"
                            title="Попробовать"
                            handleClick={() => state.intro = false}
                            customStyles="w-fit px-4 py-2.5 font-bold text-sm md:mx-0 mx-auto"
                        />
                    </motion.div>
                </motion.div>
            </motion.section>
        )}
    </AnimatePresence>
  )
}

export default Home