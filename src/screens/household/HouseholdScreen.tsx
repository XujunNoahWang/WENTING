import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, FONTS, SPACING, SUCCESS_MESSAGES } from '../../constants/index';
import { Household, HouseholdMember, HouseholdForm, User } from '../../types/index';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import HouseholdService from '../../services/household/HouseholdService';
import AuthService from '../../services/auth/AuthService';

const HouseholdScreen: React.FC = () => {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [members, setMembers] = useState<{ [key: string]: HouseholdMember[] }>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<HouseholdForm>({
    name: '',
    description: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Get current user
      const user = await AuthService.getCurrentUser();
      if (!user) {
        Alert.alert('错误', '请先登录');
        return;
      }
      setCurrentUser(user);

      // Get user's households
      const householdsResult = await HouseholdService.getUserHouseholds(user.id);
      if (householdsResult.success && householdsResult.data) {
        setHouseholds(householdsResult.data);
        
        // Load members for each household
        const membersData: { [key: string]: HouseholdMember[] } = {};
        for (const household of householdsResult.data) {
          const membersResult = await HouseholdService.getHouseholdMembers(household.id);
          if (membersResult.success && membersResult.data) {
            membersData[household.id] = membersResult.data;
          }
        }
        setMembers(membersData);
      }
    } catch (error) {
      console.error('Load household data error:', error);
      Alert.alert('错误', '加载家庭数据失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleCreateHousehold = async () => {
    if (!createForm.name.trim()) {
      Alert.alert('错误', '请输入家庭名称');
      return;
    }

    if (!currentUser) {
      Alert.alert('错误', '用户信息获取失败');
      return;
    }

    try {
      setIsCreating(true);
      
      const result = await HouseholdService.createHousehold(createForm, currentUser.id);
      
      if (result.success) {
        Alert.alert('成功', SUCCESS_MESSAGES.HOUSEHOLD_CREATED);
        setShowCreateModal(false);
        setCreateForm({ name: '', description: '' });
        await loadData(); // Reload data to show new household
      } else {
        Alert.alert('错误', result.error || '家庭创建失败');
      }
    } catch (error) {
      console.error('Create household error:', error);
      Alert.alert('错误', '家庭创建失败');
    } finally {
      setIsCreating(false);
    }
  };

  const renderHouseholdCard = (household: Household) => {
    const householdMembers = members[household.id] || [];
    const isAdmin = householdMembers.some(
      member => member.userId === currentUser?.id && member.role === 'admin'
    );

    return (
      <View key={household.id} style={styles.householdCard}>
        <View style={styles.householdHeader}>
          <Text style={styles.householdName}>{household.name}</Text>
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Text style={styles.adminText}>管理员</Text>
            </View>
          )}
        </View>
        
        {household.description && (
          <Text style={styles.householdDescription}>{household.description}</Text>
        )}

        <View style={styles.membersList}>
          <Text style={styles.membersTitle}>
            成员 ({householdMembers.length})
          </Text>
          {householdMembers.slice(0, 3).map((member) => (
            <View key={member.id} style={styles.memberItem}>
              <Icon 
                name="person-circle-outline" 
                size={24} 
                color={COLORS.TEXT_SECONDARY} 
              />
              <Text style={styles.memberName}>
                {member.user?.fullName || '未知用户'}
              </Text>
              {member.role === 'admin' && (
                <Text style={styles.memberRole}>管理员</Text>
              )}
            </View>
          ))}
          {householdMembers.length > 3 && (
            <Text style={styles.moreMembers}>
              还有 {householdMembers.length - 3} 位成员...
            </Text>
          )}
        </View>

        <View style={styles.householdActions}>
          <Button
            title="查看详情"
            variant="outline"
            size="small"
            onPress={() => {
              // TODO: Navigate to household details
              Alert.alert('提示', '家庭详情页面开发中...');
            }}
          />
          {isAdmin && (
            <Button
              title="管理成员"
              variant="primary"
              size="small"
              style={styles.actionButton}
              onPress={() => {
                // TODO: Navigate to member management
                Alert.alert('提示', '成员管理页面开发中...');
              }}
            />
          )}
        </View>
      </View>
    );
  };

  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowCreateModal(false)}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={() => setShowCreateModal(false)}
            style={styles.closeButton}
          >
            <Icon name="close" size={24} color={COLORS.TEXT_PRIMARY} />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>创建新家庭</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.modalContent}>
          <Input
            label="家庭名称"
            placeholder="输入家庭名称"
            value={createForm.name}
            onChangeText={(text) => setCreateForm({ ...createForm, name: text })}
            required
          />
          
          <Input
            label="家庭描述"
            placeholder="输入家庭描述（可选）"
            value={createForm.description}
            onChangeText={(text) => setCreateForm({ ...createForm, description: text })}
            multiline
            numberOfLines={3}
            style={{ height: 80 }}
          />

          <Text style={styles.infoText}>
            创建家庭后，您将成为管理员，可以邀请其他成员加入。
          </Text>
        </ScrollView>

        <View style={styles.modalFooter}>
          <Button
            title="取消"
            variant="outline"
            onPress={() => setShowCreateModal(false)}
            style={styles.footerButton}
          />
          <Button
            title="创建"
            variant="primary"
            onPress={handleCreateHousehold}
            loading={isCreating}
            style={styles.footerButton}
          />
        </View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>我的家庭</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Icon name="add" size={24} color={COLORS.PRIMARY} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {households.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="home-outline" size={80} color={COLORS.TEXT_SECONDARY} />
            <Text style={styles.emptyTitle}>暂无家庭</Text>
            <Text style={styles.emptyDescription}>
              创建您的第一个家庭，开始管理家庭健康档案
            </Text>
            <Button
              title="创建家庭"
              variant="primary"
              onPress={() => setShowCreateModal(true)}
              style={styles.createButton}
            />
          </View>
        ) : (
          <View style={styles.householdList}>
            {households.map(renderHouseholdCard)}
          </View>
        )}
      </ScrollView>

      {renderCreateModal()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.BACKGROUND,
  },
  loadingText: {
    fontSize: FONTS.SIZES.MEDIUM,
    color: COLORS.TEXT_SECONDARY,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.LG,
    paddingBottom: SPACING.MD,
  },
  title: {
    fontSize: FONTS.SIZES.XLARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.SURFACE,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY,
  },
  content: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    marginTop: SPACING.XXL,
  },
  emptyTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
    marginTop: SPACING.LG,
    marginBottom: SPACING.SM,
  },
  emptyDescription: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.LG,
  },
  createButton: {
    marginTop: SPACING.MD,
  },
  householdList: {
    paddingHorizontal: SPACING.LG,
  },
  householdCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 12,
    padding: SPACING.LG,
    marginBottom: SPACING.MD,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  householdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.SM,
  },
  householdName: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
    flex: 1,
  },
  adminBadge: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SPACING.SM,
    paddingVertical: SPACING.XS,
    borderRadius: 12,
  },
  adminText: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.BOLD,
    color: COLORS.SURFACE,
  },
  householdDescription: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    marginBottom: SPACING.MD,
    lineHeight: 20,
  },
  membersList: {
    marginBottom: SPACING.MD,
  },
  membersTitle: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
    marginBottom: SPACING.SM,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.XS,
  },
  memberName: {
    fontSize: FONTS.SIZES.MEDIUM,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_PRIMARY,
    marginLeft: SPACING.SM,
    flex: 1,
  },
  memberRole: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.PRIMARY,
  },
  moreMembers: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    fontStyle: 'italic',
    marginTop: SPACING.XS,
  },
  householdActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    marginLeft: SPACING.SM,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: FONTS.SIZES.LARGE,
    fontFamily: FONTS.BOLD,
    color: COLORS.TEXT_PRIMARY,
  },
  placeholder: {
    width: 40,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.LG,
  },
  infoText: {
    fontSize: FONTS.SIZES.SMALL,
    fontFamily: FONTS.REGULAR,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 18,
    marginTop: SPACING.MD,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.LG,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  footerButton: {
    flex: 1,
    marginHorizontal: SPACING.XS,
  },
});

export default HouseholdScreen;